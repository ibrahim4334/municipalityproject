// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./EcoCivicDeposit.sol";

/**
 * @title WaterBillingFraudManager
 * @notice Su faturası fraud tespiti ve depozito cezası yönetimi
 * @dev AI tespiti ve fiziksel kontrol sonuçlarına göre on-chain ceza uygular
 */
contract WaterBillingFraudManager is AccessControl, ReentrancyGuard {
    
    // ==============================
    // ROLES
    // ==============================
    bytes32 public constant FRAUD_DETECTOR_ROLE = keccak256("FRAUD_DETECTOR_ROLE");
    bytes32 public constant INSPECTOR_ROLE = keccak256("INSPECTOR_ROLE");
    
    // ==============================
    // STATE VARIABLES
    // ==============================
    EcoCivicDeposit public immutable depositContract;
    
    // Penalty percentages (basis points: 100 = 1%)
    uint256 public constant AI_FRAUD_PENALTY_BPS = 5000;           // %50
    uint256 public constant INSPECTION_FRAUD_PENALTY_BPS = 10000;  // %100
    uint256 public constant UNDERPAYMENT_INTEREST_BPS = 500;       // %5 aylık faiz
    uint256 public constant INSPECTION_INTERVAL = 180 days;        // 6 ay
    uint256 public constant CONSUMPTION_DROP_THRESHOLD_BPS = 5000; // %50 düşüş eşiği
    
    // Fraud status enum
    enum FraudStatus { 
        None,           // Fraud yok
        Warning,        // Uyarı verildi (%50+ düşüş)
        AIDetected,     // AI tarafından tespit edildi
        InspectionPending, // Fiziksel kontrol bekliyor
        Confirmed       // Fiziksel kontrolle onaylandı
    }
    
    // User fraud tracking
    struct UserFraudData {
        FraudStatus status;
        uint256 warningCount;
        uint256 lastInspectionDate;
        uint256 nextInspectionDue;
        uint256 totalPenaltiesPaid;
        bool isBlacklisted;
    }
    
    // Inspection record
    struct InspectionRecord {
        address user;
        address inspector;
        uint256 scheduledDate;
        uint256 completedDate;
        uint256 reportedReading;
        uint256 actualReading;
        bool fraudFound;
        bool completed;
        string notes;
    }
    
    // Consumption history (son 6 ay)
    struct ConsumptionHistory {
        uint256[6] monthlyConsumption;
        uint8 currentIndex;
        uint256 lastUpdateMonth;
    }
    
    mapping(address => UserFraudData) public userFraudData;
    mapping(address => ConsumptionHistory) public consumptionHistory;
    mapping(uint256 => InspectionRecord) public inspections;
    uint256 public inspectionCounter;
    
    // Pending inspections per user
    mapping(address => uint256[]) public userPendingInspections;
    
    bool public paused;
    
    // ==============================
    // EVENTS
    // ==============================
    event FraudWarningIssued(address indexed user, uint256 currentConsumption, uint256 avgConsumption);
    event AIFraudDetected(address indexed user, string reason, uint256 penaltyAmount);
    event InspectionFraudConfirmed(address indexed user, uint256 penaltyAmount, uint256 underpaymentWithInterest);
    event InspectionScheduled(uint256 indexed inspectionId, address indexed user, uint256 scheduledDate);
    event InspectionCompleted(uint256 indexed inspectionId, address indexed user, bool fraudFound, address inspector);
    event DepositPenalized(address indexed user, uint256 amount, string reason);
    event UserBlacklisted(address indexed user);
    event ConsumptionRecorded(address indexed user, uint256 consumption, uint256 monthIndex);
    event Paused(address account);
    event Unpaused(address account);
    
    // ==============================
    // MODIFIERS
    // ==============================
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    modifier validAddress(address _addr) {
        require(_addr != address(0), "Invalid address");
        _;
    }
    
    // ==============================
    // CONSTRUCTOR
    // ==============================
    constructor(address _depositContract) {
        require(_depositContract != address(0), "Invalid deposit contract");
        
        depositContract = EcoCivicDeposit(_depositContract);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(FRAUD_DETECTOR_ROLE, msg.sender);
        _grantRole(INSPECTOR_ROLE, msg.sender);
    }
    
    // ==============================
    // CONSUMPTION TRACKING
    // ==============================
    
    /**
     * @notice Aylık tüketimi kaydet ve %50 düşüş kontrolü yap
     * @param user Kullanıcı adresi
     * @param consumption Bu ayki tüketim (m³)
     * @return requiresConfirmation %50+ düşüş varsa true
     * @return avgConsumption Ortalama tüketim
     */
    function recordConsumption(address user, uint256 consumption) 
        external 
        onlyRole(FRAUD_DETECTOR_ROLE) 
        whenNotPaused
        validAddress(user)
        returns (bool requiresConfirmation, uint256 avgConsumption)
    {
        ConsumptionHistory storage history = consumptionHistory[user];
        
        // Ortalama hesapla (0 olmayan değerler)
        uint256 total = 0;
        uint256 count = 0;
        for (uint8 i = 0; i < 6; i++) {
            if (history.monthlyConsumption[i] > 0) {
                total += history.monthlyConsumption[i];
                count++;
            }
        }
        
        avgConsumption = count > 0 ? total / count : 0;
        
        // %50 düşüş kontrolü
        if (avgConsumption > 0) {
            uint256 dropThreshold = (avgConsumption * CONSUMPTION_DROP_THRESHOLD_BPS) / 10000;
            
            if (consumption < avgConsumption - dropThreshold) {
                // %50'den fazla düşüş
                requiresConfirmation = true;
                
                userFraudData[user].warningCount++;
                
                if (userFraudData[user].status == FraudStatus.None) {
                    userFraudData[user].status = FraudStatus.Warning;
                }
                
                emit FraudWarningIssued(user, consumption, avgConsumption);
            }
        }
        
        // Tüketimi kaydet
        history.monthlyConsumption[history.currentIndex] = consumption;
        history.currentIndex = (history.currentIndex + 1) % 6;
        history.lastUpdateMonth = block.timestamp;
        
        emit ConsumptionRecorded(user, consumption, history.currentIndex);
        
        return (requiresConfirmation, avgConsumption);
    }
    
    // ==============================
    // FRAUD DETECTION & PENALTY
    // ==============================
    
    /**
     * @notice AI tarafından fraud tespit edildiğinde depozito cezası kes
     * @param user Kullanıcı adresi
     * @param reason Fraud sebebi
     */
    function penalizeForAIFraud(address user, string calldata reason) 
        external 
        onlyRole(FRAUD_DETECTOR_ROLE)
        whenNotPaused
        validAddress(user)
        nonReentrant
    {
        require(bytes(reason).length > 0, "Reason required");
        require(!userFraudData[user].isBlacklisted, "User already blacklisted");
        
        uint256 userDeposit = depositContract.getUserDeposit(user);
        require(userDeposit > 0, "User has no deposit");
        
        // %50 ceza hesapla
        uint256 penaltyAmount = (userDeposit * AI_FRAUD_PENALTY_BPS) / 10000;
        
        // Cezayı kes (EcoCivicDeposit'tan çek)
        depositContract.withdraw(penaltyAmount, address(this));
        
        // Kullanıcı durumunu güncelle
        userFraudData[user].status = FraudStatus.AIDetected;
        userFraudData[user].totalPenaltiesPaid += penaltyAmount;
        
        // Fiziksel kontrol planla
        _scheduleInspection(user);
        
        emit AIFraudDetected(user, reason, penaltyAmount);
        emit DepositPenalized(user, penaltyAmount, reason);
    }
    
    /**
     * @notice Fiziksel kontrol sonrası fraud cezası
     * @param user Kullanıcı adresi
     * @param underpaidAmount Eksik ödenen tutar
     * @param monthsLate Kaç ay gecikme olduğu
     */
    function penalizeForInspectionFraud(
        address user, 
        uint256 underpaidAmount,
        uint256 monthsLate
    ) 
        external 
        onlyRole(INSPECTOR_ROLE)
        whenNotPaused
        validAddress(user)
        nonReentrant
    {
        require(!userFraudData[user].isBlacklisted, "User already blacklisted");
        
        uint256 userDeposit = depositContract.getUserDeposit(user);
        
        // %100 depozito cezası
        uint256 depositPenalty = userDeposit; // Tamamı
        
        // Faiz hesapla
        uint256 interestAmount = calculateInterest(underpaidAmount, monthsLate);
        uint256 totalUnderpayment = underpaidAmount + interestAmount;
        
        // Depozito cezasını kes
        if (depositPenalty > 0) {
            depositContract.withdraw(depositPenalty, address(this));
        }
        
        // Kullanıcı durumunu güncelle
        userFraudData[user].status = FraudStatus.Confirmed;
        userFraudData[user].totalPenaltiesPaid += depositPenalty;
        userFraudData[user].isBlacklisted = true;
        userFraudData[user].lastInspectionDate = block.timestamp;
        
        emit InspectionFraudConfirmed(user, depositPenalty, totalUnderpayment);
        emit DepositPenalized(user, depositPenalty, "Inspection fraud confirmed");
        emit UserBlacklisted(user);
    }
    
    // ==============================
    // INSPECTION MANAGEMENT
    // ==============================
    
    /**
     * @notice Fiziksel kontrol planla
     * @param user Kullanıcı adresi
     */
    function scheduleInspection(address user) 
        external 
        onlyRole(INSPECTOR_ROLE)
        validAddress(user)
    {
        _scheduleInspection(user);
    }
    
    function _scheduleInspection(address user) internal {
        inspectionCounter++;
        
        uint256 scheduledDate = block.timestamp + 7 days; // 1 hafta sonra
        
        inspections[inspectionCounter] = InspectionRecord({
            user: user,
            inspector: address(0),
            scheduledDate: scheduledDate,
            completedDate: 0,
            reportedReading: 0,
            actualReading: 0,
            fraudFound: false,
            completed: false,
            notes: ""
        });
        
        userPendingInspections[user].push(inspectionCounter);
        userFraudData[user].status = FraudStatus.InspectionPending;
        userFraudData[user].nextInspectionDue = scheduledDate;
        
        emit InspectionScheduled(inspectionCounter, user, scheduledDate);
    }
    
    /**
     * @notice Fiziksel kontrolü tamamla
     * @param inspectionId Kontrol ID'si
     * @param actualReading Gerçek sayaç okuması
     * @param reportedReading Bildirilen okuma
     * @param fraudFound Fraud bulundu mu
     * @param notes Notlar
     */
    function completeInspection(
        uint256 inspectionId,
        uint256 actualReading,
        uint256 reportedReading,
        bool fraudFound,
        string calldata notes
    ) 
        external 
        onlyRole(INSPECTOR_ROLE)
        whenNotPaused
    {
        InspectionRecord storage inspection = inspections[inspectionId];
        
        require(inspection.user != address(0), "Inspection not found");
        require(!inspection.completed, "Already completed");
        
        inspection.inspector = msg.sender;
        inspection.completedDate = block.timestamp;
        inspection.actualReading = actualReading;
        inspection.reportedReading = reportedReading;
        inspection.fraudFound = fraudFound;
        inspection.completed = true;
        inspection.notes = notes;
        
        address user = inspection.user;
        userFraudData[user].lastInspectionDate = block.timestamp;
        userFraudData[user].nextInspectionDue = block.timestamp + INSPECTION_INTERVAL;
        
        if (!fraudFound) {
            // Fraud yoksa durumu temizle
            if (userFraudData[user].status != FraudStatus.Confirmed) {
                userFraudData[user].status = FraudStatus.None;
            }
        }
        
        emit InspectionCompleted(inspectionId, user, fraudFound, msg.sender);
    }
    
    // ==============================
    // UTILITY FUNCTIONS
    // ==============================
    
    /**
     * @notice Faiz hesapla (bileşik faiz)
     * @param amount Ana tutar
     * @param monthsLate Gecikme ay sayısı
     * @return Faiz tutarı
     */
    function calculateInterest(uint256 amount, uint256 monthsLate) 
        public 
        pure 
        returns (uint256) 
    {
        if (amount == 0 || monthsLate == 0) return 0;
        
        // Basit faiz: amount * rate * months
        // Daha kapsamlı bileşik faiz için ayrı hesaplama yapılabilir
        uint256 interest = (amount * UNDERPAYMENT_INTEREST_BPS * monthsLate) / 10000;
        
        return interest;
    }
    
    /**
     * @notice Kullanıcının kontrol gerekli mi kontrol et
     */
    function isInspectionDue(address user) external view returns (bool) {
        UserFraudData storage data = userFraudData[user];
        
        if (data.isBlacklisted) return false;
        if (data.lastInspectionDate == 0) return true; // Hiç kontrol yapılmamış
        
        return block.timestamp >= data.nextInspectionDue;
    }
    
    /**
     * @notice Kullanıcının ortalama tüketimini getir
     */
    function getAverageConsumption(address user) external view returns (uint256) {
        ConsumptionHistory storage history = consumptionHistory[user];
        
        uint256 total = 0;
        uint256 count = 0;
        
        for (uint8 i = 0; i < 6; i++) {
            if (history.monthlyConsumption[i] > 0) {
                total += history.monthlyConsumption[i];
                count++;
            }
        }
        
        return count > 0 ? total / count : 0;
    }
    
    /**
     * @notice Kullanıcının fraud durumunu getir
     */
    function getUserFraudStatus(address user) 
        external 
        view 
        returns (
            FraudStatus status,
            uint256 warningCount,
            uint256 lastInspection,
            uint256 totalPenalties,
            bool blacklisted
        ) 
    {
        UserFraudData storage data = userFraudData[user];
        return (
            data.status,
            data.warningCount,
            data.lastInspectionDate,
            data.totalPenaltiesPaid,
            data.isBlacklisted
        );
    }
    
    // ==============================
    // ADMIN FUNCTIONS
    // ==============================
    
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!paused, "Already paused");
        paused = true;
        emit Paused(msg.sender);
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(paused, "Not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }
    
    /**
     * @notice Kesilen cezaları belediye kasasına transfer et
     */
    function withdrawPenalties(address to, uint256 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE)
        validAddress(to)
        nonReentrant
    {
        // Bu kontrata transfer edilen tokenları çek
        // Not: EcoCivicDeposit'tan çekilen tokenlar bu kontratta birikir
        IERC20 token = depositContract.depositToken();
        require(token.transfer(to, amount), "Transfer failed");
    }
    
    // ==============================
    // INSPECTOR WHITELIST
    // ==============================
    
    mapping(address => bool) public inspectorWhitelist;
    address[] public inspectorList;
    
    event InspectorAdded(address indexed inspector);
    event InspectorRemoved(address indexed inspector);
    
    /**
     * @notice Inspector'ı whitelist'e ekle
     * @param inspector Inspector adresi
     */
    function addInspectorToWhitelist(address inspector) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE)
        validAddress(inspector)
    {
        require(!inspectorWhitelist[inspector], "Already in whitelist");
        
        inspectorWhitelist[inspector] = true;
        inspectorList.push(inspector);
        
        // INSPECTOR_ROLE ver
        _grantRole(INSPECTOR_ROLE, inspector);
        
        emit InspectorAdded(inspector);
    }
    
    /**
     * @notice Inspector'ı whitelist'ten çıkar
     * @param inspector Inspector adresi
     */
    function removeInspectorFromWhitelist(address inspector) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE)
        validAddress(inspector)
    {
        require(inspectorWhitelist[inspector], "Not in whitelist");
        
        inspectorWhitelist[inspector] = false;
        
        // INSPECTOR_ROLE kaldır
        _revokeRole(INSPECTOR_ROLE, inspector);
        
        // List'ten kaldır (gas-intensive, küçük listler için OK)
        for (uint i = 0; i < inspectorList.length; i++) {
            if (inspectorList[i] == inspector) {
                inspectorList[i] = inspectorList[inspectorList.length - 1];
                inspectorList.pop();
                break;
            }
        }
        
        emit InspectorRemoved(inspector);
    }
    
    /**
     * @notice Inspector yetkili mi kontrol et
     * @param inspector Inspector adresi
     */
    function isInspectorAuthorized(address inspector) 
        external 
        view 
        returns (bool) 
    {
        return inspectorWhitelist[inspector];
    }
    
    /**
     * @notice Tüm yetkili inspector'ları getir
     */
    function getInspectorList() 
        external 
        view 
        returns (address[] memory) 
    {
        return inspectorList;
    }
    
    /**
     * @notice Toplam inspector sayısı
     */
    function getInspectorCount() 
        external 
        view 
        returns (uint256) 
    {
        return inspectorList.length;
    }
}
