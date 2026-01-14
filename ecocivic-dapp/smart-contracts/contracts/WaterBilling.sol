// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./BELTToken.sol";

/**
 * @title WaterBilling
 * @notice Su sayacı endeksine göre fatura ödeme, ödül dağıtımı ve fraud takibi.
 * @dev WaterBillingFraudManager ile entegre çalışır
 */
contract WaterBilling is AccessControl, ReentrancyGuard {
    
    // ==============================
    // ROLES (OpenZeppelin AccessControl)
    // ==============================
    // SERVICE_OPERATOR_ROLE: AI Backend - OCR okuma, anomaly tespiti
    bytes32 public constant SERVICE_OPERATOR_ROLE = keccak256("SERVICE_OPERATOR_ROLE");
    // FRAUD_MANAGER_ROLE: Fraud yönetimi kontratı
    bytes32 public constant FRAUD_MANAGER_ROLE = keccak256("FRAUD_MANAGER_ROLE");
    // MUNICIPALITY_STAFF_ROLE: Belediye Personeli - 6 aylık kontrol, atık kontrolü
    bytes32 public constant MUNICIPALITY_STAFF_ROLE = keccak256("MUNICIPALITY_STAFF_ROLE");
    // ORACLE_ROLE: Dış veri sağlayıcı - GPS, realtime değerler
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    
    // ==============================
    // STATE VARIABLES
    // ==============================
    BELTToken public immutable beltToken;
    
    // Son bilinen endeks
    mapping(address => uint256) public lastReading;
    
    // Tüketim geçmişi (son 6 ay için)
    struct ConsumptionData {
        uint256[6] monthlyConsumption;
        uint8 currentIndex;
        uint256 lastSubmissionTime;
        uint256 totalConsumption;
    }
    mapping(address => ConsumptionData) public consumptionHistory;
    
    // Fraud durumu
    enum UserStatus { 
        Active,             // Normal kullanıcı
        PendingConfirmation, // %50+ düşüş, onay bekliyor
        UnderReview,        // İnceleme altında
        Suspended           // Askıya alındı
    }
    
    mapping(address => UserStatus) public userStatus;
    mapping(address => bool) public pendingConfirmations;
    
    // Sayaç numarası eşleştirmesi
    mapping(address => string) public userMeterNo;
    mapping(string => address) public meterToUser;
    
    bool public paused;
    
    // ==============================
    // CONSTANTS
    // ==============================
    uint256 public constant CONSUMPTION_DROP_THRESHOLD = 50; // %50
    uint256 public constant REWARD_MULTIPLIER = 1; // 1 m³ = 1 BELT
    
    // ==============================
    // EVENTS
    // ==============================
    event ReadingSubmitted(
        address indexed user, 
        uint256 newReading, 
        uint256 consumption,
        uint256 rewardAmount
    );
    event ConsumptionDropWarning(
        address indexed user, 
        uint256 currentConsumption, 
        uint256 averageConsumption,
        uint256 dropPercent
    );
    event ConfirmationRequired(address indexed user, string reason);
    event ConfirmationProvided(address indexed user, bool confirmed);
    event UserStatusChanged(address indexed user, UserStatus oldStatus, UserStatus newStatus);
    event MeterRegistered(address indexed user, string meterNo);
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
    
    modifier userNotSuspended(address user) {
        require(userStatus[user] != UserStatus.Suspended, "User is suspended");
        _;
    }
    
    // ==============================
    // CONSTRUCTOR
    // ==============================
    constructor(address _beltToken) {
        require(_beltToken != address(0), "Invalid BELT token address");
        
        beltToken = BELTToken(_beltToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SERVICE_OPERATOR_ROLE, msg.sender);
    }
    
    // ==============================
    // METER REGISTRATION
    // ==============================
    
    /**
     * @notice Kullanıcıya sayaç numarası ata
     */
    function registerMeter(address user, string calldata meterNo) 
        external 
        onlyRole(SERVICE_OPERATOR_ROLE)
        validAddress(user)
    {
        require(bytes(meterNo).length > 0, "Meter number required");
        require(meterToUser[meterNo] == address(0), "Meter already registered");
        
        // Önceki sayacı temizle
        string memory oldMeter = userMeterNo[user];
        if (bytes(oldMeter).length > 0) {
            delete meterToUser[oldMeter];
        }
        
        userMeterNo[user] = meterNo;
        meterToUser[meterNo] = user;
        
        emit MeterRegistered(user, meterNo);
    }
    
    // ==============================
    // READING SUBMISSION
    // ==============================
    
    /**
     * @notice Sayaç okuması gönder (backend tarafından çağrılır)
     * @param user Kullanıcı adresi
     * @param newReading Yeni endeks değeri
     * @param userConfirmed Düşük tüketim onayı verildi mi
     * @return requiresConfirmation Onay gerekiyor mu
     * @return consumption Bu ayki tüketim
     */
    function submitReading(
        address user, 
        uint256 newReading,
        bool userConfirmed
    ) 
        external 
        onlyRole(SERVICE_OPERATOR_ROLE)
        whenNotPaused
        validAddress(user)
        userNotSuspended(user)
        nonReentrant
        returns (bool requiresConfirmation, uint256 consumption)
    {
        require(newReading > 0, "Reading must be > 0");
        
        uint256 previous = lastReading[user];
        require(newReading > previous, "New reading must be greater than last reading");
        
        consumption = newReading - previous;
        
        // Tüketim düşüş kontrolü
        uint256 avgConsumption = _getAverageConsumption(user);
        
        if (avgConsumption > 0) {
            // %50'den fazla düşüş var mı?
            if (consumption * 100 < avgConsumption * (100 - CONSUMPTION_DROP_THRESHOLD)) {
                uint256 dropPercent = ((avgConsumption - consumption) * 100) / avgConsumption;
                
                emit ConsumptionDropWarning(user, consumption, avgConsumption, dropPercent);
                
                // Onay verilmemişse beklet
                if (!userConfirmed) {
                    pendingConfirmations[user] = true;
                    _updateUserStatus(user, UserStatus.PendingConfirmation);
                    
                    emit ConfirmationRequired(user, "Consumption dropped more than 50%");
                    
                    return (true, consumption);
                }
                
                // Onay verildi
                emit ConfirmationProvided(user, true);
            }
        }
        
        // Bekleyen onay varsa temizle
        if (pendingConfirmations[user]) {
            pendingConfirmations[user] = false;
            if (userStatus[user] == UserStatus.PendingConfirmation) {
                _updateUserStatus(user, UserStatus.Active);
            }
        }
        
        // Okuması kaydet
        lastReading[user] = newReading;
        
        // Tüketim geçmişini güncelle
        _updateConsumptionHistory(user, consumption);
        
        // Ödül ver
        uint256 rewardAmount = consumption * REWARD_MULTIPLIER;
        if (rewardAmount > 0) {
            beltToken.mint(user, rewardAmount);
        }
        
        emit ReadingSubmitted(user, newReading, consumption, rewardAmount);
        
        return (false, consumption);
    }
    
    /**
     * @notice Eski uyumlu submitReading (onay gerektirmeden)
     */
    function submitReadingLegacy(address user, uint256 newReading) 
        external 
        onlyRole(SERVICE_OPERATOR_ROLE)
        whenNotPaused
        validAddress(user)
    {
        require(newReading > 0, "Reading must be > 0");
        
        uint256 previous = lastReading[user];
        require(newReading > previous, "New reading must be greater than last reading");
        
        uint256 consumption = newReading - previous;
        lastReading[user] = newReading;
        
        _updateConsumptionHistory(user, consumption);
        
        uint256 rewardAmount = consumption * REWARD_MULTIPLIER;
        if (rewardAmount > 0) {
            beltToken.mint(user, rewardAmount);
        }
        
        emit ReadingSubmitted(user, newReading, consumption, rewardAmount);
    }
    
    // ==============================
    // CONSUMPTION HISTORY
    // ==============================
    
    function _updateConsumptionHistory(address user, uint256 consumption) internal {
        ConsumptionData storage data = consumptionHistory[user];
        
        data.monthlyConsumption[data.currentIndex] = consumption;
        data.currentIndex = (data.currentIndex + 1) % 6;
        data.lastSubmissionTime = block.timestamp;
        data.totalConsumption += consumption;
    }
    
    function _getAverageConsumption(address user) internal view returns (uint256) {
        ConsumptionData storage data = consumptionHistory[user];
        
        uint256 total = 0;
        uint256 count = 0;
        
        for (uint8 i = 0; i < 6; i++) {
            if (data.monthlyConsumption[i] > 0) {
                total += data.monthlyConsumption[i];
                count++;
            }
        }
        
        return count > 0 ? total / count : 0;
    }
    
    /**
     * @notice Kullanıcının tüketim geçmişini getir
     */
    function getConsumptionHistory(address user) 
        external 
        view 
        returns (
            uint256[6] memory monthly,
            uint256 average,
            uint256 total,
            uint256 lastSubmission
        ) 
    {
        ConsumptionData storage data = consumptionHistory[user];
        
        return (
            data.monthlyConsumption,
            _getAverageConsumption(user),
            data.totalConsumption,
            data.lastSubmissionTime
        );
    }
    
    // ==============================
    // STATUS MANAGEMENT
    // ==============================
    
    function _updateUserStatus(address user, UserStatus newStatus) internal {
        UserStatus oldStatus = userStatus[user];
        if (oldStatus != newStatus) {
            userStatus[user] = newStatus;
            emit UserStatusChanged(user, oldStatus, newStatus);
        }
    }
    
    /**
     * @notice Fraud Manager tarafından kullanıcı durumunu değiştir
     */
    function setUserStatus(address user, UserStatus status) 
        external 
        onlyRole(FRAUD_MANAGER_ROLE)
        validAddress(user)
    {
        _updateUserStatus(user, status);
    }
    
    /**
     * @notice Kullanıcıyı askıya al
     */
    function suspendUser(address user) 
        external 
        onlyRole(FRAUD_MANAGER_ROLE)
        validAddress(user)
    {
        _updateUserStatus(user, UserStatus.Suspended);
    }
    
    /**
     * @notice Kullanıcıyı yeniden aktifleştir
     */
    function reactivateUser(address user) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE)
        validAddress(user)
    {
        _updateUserStatus(user, UserStatus.Active);
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
     * @notice Fraud Manager rolü ver
     */
    function setFraudManager(address fraudManager) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE)
        validAddress(fraudManager)
    {
        _grantRole(FRAUD_MANAGER_ROLE, fraudManager);
    }
    
    // ==============================
    // ON-CHAIN DEPOSIT & PENALTY SYSTEM
    // ==============================
    
    // Kullanıcı depozitoleri (on-chain görünürlük için)
    mapping(address => uint256) public userDeposits;
    
    // Fatura bilgileri
    mapping(address => uint256) public outstandingBills;
    mapping(address => uint256) public lastBillAmount;
    
    // Fraud ceza sabitleri
    uint256 public constant FRAUD_PENALTY_PERCENT = 50;  // %50 AI fraud cezası
    uint256 public constant FULL_PENALTY_PERCENT = 100;  // %100 fiziksel kontrol cezası
    uint256 public constant MONTHLY_INTEREST_RATE = 5;   // %5 aylık faiz
    uint256 public constant REQUIRED_DEPOSIT = 2000 * 10**18; // 2000 TL depozito
    
    // Events
    event DepositReceived(address indexed user, uint256 amount);
    event DepositWithdrawn(address indexed user, uint256 amount);
    event FraudPenaltyApplied(address indexed user, uint256 penaltyAmount, string reason);
    event PeriodicInspectionResult(address indexed user, bool fraudFound, uint256 penaltyAmount);
    event BillAdjusted(address indexed user, uint256 correctUsage, uint256 interestFee, uint256 newBillAmount);
    event BillPaid(address indexed user, uint256 amount);
    
    /**
     * @notice Kullanıcı depozito yatırır
     * @dev Gerçek implementasyonda ERC20 token transfer olacak
     */
    function depositFunds(uint256 amount) 
        external 
        whenNotPaused
        nonReentrant
    {
        require(amount > 0, "Amount must be > 0");
        
        userDeposits[msg.sender] += amount;
        
        emit DepositReceived(msg.sender, amount);
    }
    
    /**
     * @notice Depozito miktarını güncelle (admin/operator tarafından)
     */
    function setUserDeposit(address user, uint256 amount) 
        external 
        onlyRole(SERVICE_OPERATOR_ROLE)
        validAddress(user)
    {
        userDeposits[user] = amount;
        emit DepositReceived(user, amount);
    }
    
    /**
     * @notice Fraud tespit edildiğinde ceza uygula
     * @param user Kullanıcı adresi
     * @param reason Fraud sebebi
     */
    function reportFraud(address user, string calldata reason) 
        external 
        onlyRole(FRAUD_MANAGER_ROLE)
        validAddress(user)
        nonReentrant
    {
        require(bytes(reason).length > 0, "Reason required");
        
        uint256 currentDeposit = userDeposits[user];
        require(currentDeposit > 0, "User has no deposit");
        
        // Ceza hesapla (%50)
        uint256 penalty = calculatePenalty(user, FRAUD_PENALTY_PERCENT);
        
        // Depozitodan kes
        userDeposits[user] -= penalty;
        
        // Kullanıcıyı incelemeye al
        _updateUserStatus(user, UserStatus.UnderReview);
        
        emit FraudPenaltyApplied(user, penalty, reason);
    }
    
    /**
     * @notice 6 aylık fiziksel kontrol sonucu
     * @param user Kullanıcı adresi
     * @param fraudFound Fraud bulundu mu
     * @param actualReading Gerçek sayaç okuması
     * @param reportedReading Bildirilen okuma
     */
    function periodicInspectionResult(
        address user, 
        bool fraudFound,
        uint256 actualReading,
        uint256 reportedReading
    ) 
        external 
        onlyRole(FRAUD_MANAGER_ROLE)
        validAddress(user)
        nonReentrant
    {
        uint256 penaltyAmount = 0;
        
        if (fraudFound) {
            // Tüm depozitoyu kes
            penaltyAmount = userDeposits[user];
            userDeposits[user] = 0;
            
            // Eksik ödeme varsa hesapla
            if (actualReading > reportedReading) {
                uint256 underreportedUsage = actualReading - reportedReading;
                // Fatura farkını hesapla ve faiz ekle
                adjustBillAfterRealAudit(user, underreportedUsage);
            }
            
            // Kullanıcıyı askıya al
            _updateUserStatus(user, UserStatus.Suspended);
        } else {
            // Fraud yok, durumu normale çevir
            if (userStatus[user] == UserStatus.UnderReview) {
                _updateUserStatus(user, UserStatus.Active);
            }
        }
        
        emit PeriodicInspectionResult(user, fraudFound, penaltyAmount);
    }
    
    /**
     * @notice Gerçek denetim sonrası fatura düzeltmesi
     * @param user Kullanıcı adresi
     * @param correctUsage Doğru tüketim miktarı (m³)
     */
    function adjustBillAfterRealAudit(address user, uint256 correctUsage) 
        internal
    {
        // Tarihsel tüketimle karşılaştır
        ConsumptionData storage history = consumptionHistory[user];
        
        // Son 6 aydaki ortalama fark hesapla (basitleştirilmiş)
        uint256 avgConsumption = _getAverageConsumption(user);
        
        // Eksik bildirilen miktar için fatura hesapla
        // Varsayım: 1 m³ = 10 birim fiyat
        uint256 unitPrice = 10;
        uint256 additionalBill = correctUsage * unitPrice;
        
        // Faiz hesapla (ortalama 3 ay gecikme varsayımı)
        uint256 monthsLate = 3;
        uint256 interestFee = calculateInterest(additionalBill, monthsLate);
        
        // Toplam fatura
        uint256 newBillAmount = additionalBill + interestFee;
        
        outstandingBills[user] += newBillAmount;
        lastBillAmount[user] = newBillAmount;
        
        emit BillAdjusted(user, correctUsage, interestFee, newBillAmount);
    }
    
    /**
     * @notice Ceza miktarı hesapla
     * @param user Kullanıcı adresi
     * @param penaltyPercent Ceza yüzdesi (0-100)
     */
    function calculatePenalty(address user, uint256 penaltyPercent) 
        public 
        view 
        returns (uint256) 
    {
        require(penaltyPercent <= 100, "Penalty cannot exceed 100%");
        
        uint256 deposit = userDeposits[user];
        return (deposit * penaltyPercent) / 100;
    }
    
    /**
     * @notice Faiz hesapla
     * @param amount Ana tutar
     * @param monthsLate Gecikme ay sayısı
     */
    function calculateInterest(uint256 amount, uint256 monthsLate) 
        public 
        pure 
        returns (uint256) 
    {
        if (amount == 0 || monthsLate == 0) return 0;
        
        // Basit faiz: amount * rate% * months
        return (amount * MONTHLY_INTEREST_RATE * monthsLate) / 100;
    }
    
    /**
     * @notice Kullanıcının depozito durumunu getir
     */
    function getUserDepositInfo(address user) 
        external 
        view 
        returns (
            uint256 depositAmount,
            uint256 outstandingBill,
            bool hasRequiredDeposit
        ) 
    {
        return (
            userDeposits[user],
            outstandingBills[user],
            userDeposits[user] >= REQUIRED_DEPOSIT
        );
    }
    
    /**
     * @notice Ödenmemiş fatura öde
     */
    function payOutstandingBill(uint256 amount) 
        external 
        whenNotPaused
        nonReentrant
    {
        require(amount > 0, "Amount must be > 0");
        require(outstandingBills[msg.sender] >= amount, "Amount exceeds outstanding bill");
        
        outstandingBills[msg.sender] -= amount;
        
        emit BillPaid(msg.sender, amount);
    }
    
    // ==============================
    // AI / BACKEND INTEGRATION FUNCTIONS
    // ==============================
    
    // Events for new functions
    event FraudEvidenceSubmitted(address indexed user, uint256 score, address submittedBy);
    event PhysicalInspectionRecorded(address indexed user, bool isFraud, address inspector);
    event InterestPenaltyApplied(address indexed user, uint256 originalAmount, uint256 interestAmount, uint256 totalAmount);
    event UserConfirmationRequested(address indexed user, uint256 currentReading, uint256 avgConsumption);
    event UserConfirmationReceived(address indexed user, bool confirmed);
    
    /**
     * @notice AI Backend tarafından fraud kanıtı gönder
     * @param user Kullanıcı adresi
     * @param score Fraud skoru (0-100)
     * @dev SERVICE_OPERATOR_ROLE (AI Backend) tarafından çağrılır
     */
    function submitFraudEvidence(address user, uint256 score) 
        external 
        onlyRole(SERVICE_OPERATOR_ROLE)
        validAddress(user)
    {
        require(score <= 100, "Score must be 0-100");
        
        if (score >= 70) {
            // Critical - otomatik ceza
            uint256 penalty = calculatePenalty(user, FRAUD_PENALTY_PERCENT);
            if (penalty > 0 && userDeposits[user] >= penalty) {
                userDeposits[user] -= penalty;
                _updateUserStatus(user, UserStatus.UnderReview);
                emit FraudPenaltyApplied(user, penalty, "AI fraud score critical");
            }
        } else if (score >= 50) {
            // High - incelemeye al
            _updateUserStatus(user, UserStatus.UnderReview);
        }
        
        emit FraudEvidenceSubmitted(user, score, msg.sender);
    }
    
    /**
     * @notice Fiziksel kontrol sonucunu kaydet
     * @param user Kullanıcı adresi  
     * @param isFraud Fraud bulundu mu
     * @dev MUNICIPALITY_STAFF_ROLE veya FRAUD_MANAGER_ROLE tarafından çağrılır
     */
    function recordPhysicalInspection(address user, bool isFraud) 
        external 
        validAddress(user)
    {
        require(
            hasRole(MUNICIPALITY_STAFF_ROLE, msg.sender) || 
            hasRole(FRAUD_MANAGER_ROLE, msg.sender),
            "Not authorized inspector"
        );
        
        if (isFraud) {
            // Tüm depozitoyu kes
            uint256 penalty = userDeposits[user];
            userDeposits[user] = 0;
            
            _updateUserStatus(user, UserStatus.Suspended);
            
            emit FraudPenaltyApplied(user, penalty, "Physical inspection fraud");
        } else {
            // Fraud yok, aktife çevir
            if (userStatus[user] == UserStatus.UnderReview) {
                _updateUserStatus(user, UserStatus.Active);
            }
        }
        
        emit PhysicalInspectionRecorded(user, isFraud, msg.sender);
    }
    
    /**
     * @notice Doğru tüketim üzerinden faiz cezası uygula
     * @param user Kullanıcı adresi
     * @param correctUsage Doğru tüketim miktarı (m³)
     * @dev FRAUD_MANAGER_ROLE tarafından çağrılır
     */
    function applyInterestPenalty(address user, uint256 correctUsage) 
        external 
        onlyRole(FRAUD_MANAGER_ROLE)
        validAddress(user)
    {
        require(correctUsage > 0, "Usage must be > 0");
        
        // Birim fiyat (varsayım: 10 TL/m³)
        uint256 unitPrice = 10;
        uint256 baseAmount = correctUsage * unitPrice;
        
        // Faiz hesapla (varsayım: 3 ay gecikme)
        uint256 monthsLate = 3;
        uint256 interestAmount = calculateInterest(baseAmount, monthsLate);
        
        uint256 totalAmount = baseAmount + interestAmount;
        
        outstandingBills[user] += totalAmount;
        
        emit InterestPenaltyApplied(user, baseAmount, interestAmount, totalAmount);
    }
    
    /**
     * @notice Kullanıcıdan onay iste (%50+ düşüş durumunda)
     * @param user Kullanıcı adresi
     * @return Mevcut onay durumu
     * @dev SERVICE_OPERATOR_ROLE tarafından çağrılır
     */
    function requestUserConfirmation(address user) 
        external 
        onlyRole(SERVICE_OPERATOR_ROLE)
        validAddress(user)
        returns (bool)
    {
        _updateUserStatus(user, UserStatus.PendingConfirmation);
        pendingConfirmations[user] = true;
        
        uint256 avgConsumption = _getAverageConsumption(user);
        
        emit UserConfirmationRequested(user, lastReading[user], avgConsumption);
        
        return true;
    }
    
    /**
     * @notice Kullanıcı onayını kaydet
     * @param user Kullanıcı adresi
     * @param confirmed Kullanıcı onayladı mı
     */
    function confirmUserReading(address user, bool confirmed) 
        external 
        onlyRole(SERVICE_OPERATOR_ROLE)
        validAddress(user)
    {
        require(pendingConfirmations[user], "No pending confirmation");
        
        pendingConfirmations[user] = false;
        
        if (confirmed) {
            _updateUserStatus(user, UserStatus.Active);
        } else {
            // Onaylamadı - incelemeye al
            _updateUserStatus(user, UserStatus.UnderReview);
        }
        
        emit UserConfirmationReceived(user, confirmed);
    }
}