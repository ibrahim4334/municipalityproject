// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./BELTToken.sol";

/**
 * @title RecyclingRewards
 * @notice Geri dönüşüm ödül sistemi - atık türlerine göre token kazanımı
 * @dev Personel onayı zorunlu, fraud kontrolü yapılır
 */
contract RecyclingRewards is AccessControl, ReentrancyGuard {

    // ==============================
    // ROLES
    // ==============================
    bytes32 public constant SERVICE_OPERATOR_ROLE = keccak256("SERVICE_OPERATOR_ROLE");
    bytes32 public constant MUNICIPALITY_STAFF_ROLE = keccak256("MUNICIPALITY_STAFF_ROLE");

    BELTToken public beltToken;

    // ==============================
    // WASTE TYPES & TOKEN RATES
    // ==============================
    enum WasteType {
        Plastic,      // Plastik - 10 token/kg
        Glass,        // Cam - 12 token/kg
        Metal,        // Metal - 15 token/kg
        Paper,        // Kağıt/Karton - 8 token/kg
        Electronic    // Elektronik - 25 token/adet
    }

    // Token rates (per kg, elektronik için adet)
    // Değerler: 10 = 1.0 token (ondalık destei için 10x çarpan)
    mapping(WasteType => uint256) public tokenRatePerUnit;
    
    // Waste type labels (for verification)
    mapping(WasteType => string) public wasteTypeLabels;
    
    // Waste subcategories
    mapping(WasteType => string[]) private wasteSubcategories;

    // QR hash tekrar kullanım kontrolü
    mapping(string => bool) public usedQrHashes;
    
    // Pending approvals (staff onayı bekleyenler)
    struct PendingSubmission {
        address user;
        WasteType wasteType;
        uint256 amount;         // kg veya adet
        string qrHash;
        string subcategory;     // PET, HDPE, yeşil cam, vb.
        uint256 submittedAt;
        bool approved;
        bool rejected;
        address approvedBy;
        string rejectionReason;
    }
    
    mapping(uint256 => PendingSubmission) public pendingSubmissions;
    uint256 public submissionCounter;
    mapping(address => uint256[]) public userSubmissions;
    
    // Fraud tracking
    mapping(address => uint256) public userFraudCount;
    mapping(address => bool) public isBlacklisted;

    bool public paused;

    uint256 public constant MAX_AMOUNT_PER_SUBMISSION = 1000; // Max 1000 kg/adet per submission

    // ==============================
    // EVENTS - v1 Enhanced for Blockchain Visibility
    // ==============================
    // Submission events
    event SubmissionCreated(
        uint256 indexed submissionId,
        address indexed user,
        WasteType wasteType,
        uint256 amount,
        string subcategory,
        string qrHash
    );
    
    // Decision events (staff karar sonrası)
    event SubmissionApproved(
        uint256 indexed submissionId,
        address indexed user,
        uint256 rewardAmount,
        address approvedBy
    );
    event SubmissionRejected(
        uint256 indexed submissionId,
        address indexed user,
        string reason,
        address rejectedBy
    );
    
    // Token events (blockchain visibility için)
    event TokenMinted(
        address indexed user,
        uint256 amount,
        uint256 indexed submissionId,
        string qrHash
    );
    event QRCodeClaimed(
        string indexed qrHash,
        address indexed user,
        uint256 rewardAmount,
        uint256 timestamp
    );
    
    // Fraud events (SADECE staff/admin kararı sonrası)
    event FraudMarkedByStaff(address indexed user, uint256 indexed submissionId, string reason, address markedBy);
    event UserBlacklisted(address indexed user, string reason);
    event TokenRateUpdated(WasteType wasteType, uint256 newRate);
    event Paused(address account);
    event Unpaused(address account);
    
    // Legacy events (geriye uyumluluk)
    event FraudDetected(address indexed user, string reason); // DEPRECATED - use FraudMarkedByStaff

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
    
    modifier notBlacklisted(address user) {
        require(!isBlacklisted[user], "User is blacklisted");
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
        _grantRole(MUNICIPALITY_STAFF_ROLE, msg.sender);

        // Token rates (10x multiplier for decimals: 100 = 10 token)
        tokenRatePerUnit[WasteType.Plastic] = 100;     // 10 token/kg
        tokenRatePerUnit[WasteType.Glass] = 120;       // 12 token/kg
        tokenRatePerUnit[WasteType.Metal] = 150;       // 15 token/kg
        tokenRatePerUnit[WasteType.Paper] = 80;        // 8 token/kg
        tokenRatePerUnit[WasteType.Electronic] = 250;  // 25 token/adet
        
        // Labels
        wasteTypeLabels[WasteType.Plastic] = "Plastik";
        wasteTypeLabels[WasteType.Glass] = "Cam";
        wasteTypeLabels[WasteType.Metal] = "Metal";
        wasteTypeLabels[WasteType.Paper] = "Kagit/Karton";
        wasteTypeLabels[WasteType.Electronic] = "Elektronik";
    }

    // ==============================
    // CITIZEN FUNCTIONS
    // ==============================

    /**
     * @notice Vatandaş geri dönüşüm bildirimi yapar (onay bekler)
     * @param wasteType Atık türü
     * @param amount Miktar (kg veya adet)
     * @param qrHash Unique QR hash
     * @param subcategory Alt kategori (PET, HDPE, yeşil cam, vb.)
     */
    function submitRecycling(
        WasteType wasteType,
        uint256 amount,
        string calldata qrHash,
        string calldata subcategory
    ) 
        external 
        whenNotPaused 
        notBlacklisted(msg.sender)
        nonReentrant
        returns (uint256 submissionId)
    {
        require(amount > 0, "Amount must be > 0");
        require(amount <= MAX_AMOUNT_PER_SUBMISSION, "Amount exceeds maximum");
        require(bytes(qrHash).length > 0, "QR hash required");
        require(!usedQrHashes[qrHash], "QR hash already used");

        submissionCounter++;
        submissionId = submissionCounter;

        pendingSubmissions[submissionId] = PendingSubmission({
            user: msg.sender,
            wasteType: wasteType,
            amount: amount,
            qrHash: qrHash,
            subcategory: subcategory,
            submittedAt: block.timestamp,
            approved: false,
            rejected: false,
            approvedBy: address(0),
            rejectionReason: ""
        });

        userSubmissions[msg.sender].push(submissionId);
        usedQrHashes[qrHash] = true;

        emit SubmissionCreated(submissionId, msg.sender, wasteType, amount, subcategory, qrHash);
        
        return submissionId;
    }

    // ==============================
    // STAFF APPROVAL FUNCTIONS
    // ==============================

    /**
     * @notice Personel onayı - ödül verilir
     * @param submissionId Submission ID
     */
    function approveSubmission(uint256 submissionId) 
        external 
        onlyRole(MUNICIPALITY_STAFF_ROLE) 
        whenNotPaused
        nonReentrant
    {
        PendingSubmission storage submission = pendingSubmissions[submissionId];
        
        require(submission.user != address(0), "Submission not found");
        require(!submission.approved, "Already approved");
        require(!submission.rejected, "Already rejected");
        require(!isBlacklisted[submission.user], "User is blacklisted");

        submission.approved = true;
        submission.approvedBy = msg.sender;

        // Token hesapla
        uint256 reward = calculateReward(submission.wasteType, submission.amount);
        require(reward > 0, "Reward calculation failed");

        // Token mint
        beltToken.mint(submission.user, reward);

        // v1: Enhanced event logging for blockchain visibility
        emit TokenMinted(submission.user, reward, submissionId, submission.qrHash);
        emit QRCodeClaimed(submission.qrHash, submission.user, reward, block.timestamp);
        emit SubmissionApproved(submissionId, submission.user, reward, msg.sender);
    }

    /**
     * @notice Personel reddi - fraud durumunda
     * @param submissionId Submission ID
     * @param reason Red sebebi
     * @param isFraud Fraud mu
     */
    function rejectSubmission(
        uint256 submissionId, 
        string calldata reason,
        bool isFraud
    ) 
        external 
        onlyRole(MUNICIPALITY_STAFF_ROLE)
        whenNotPaused
    {
        PendingSubmission storage submission = pendingSubmissions[submissionId];
        
        require(submission.user != address(0), "Submission not found");
        require(!submission.approved, "Already approved");
        require(!submission.rejected, "Already rejected");
        require(bytes(reason).length > 0, "Reason required");

        submission.rejected = true;
        submission.rejectionReason = reason;
        submission.approvedBy = msg.sender;

        if (isFraud) {
            userFraudCount[submission.user]++;
            
            // v1: Enhanced fraud event with staff info
            emit FraudMarkedByStaff(submission.user, submissionId, reason, msg.sender);
            emit FraudDetected(submission.user, reason); // Legacy event
            
            // 3 fraud = blacklist (v1: 2 hak sistemi için değiştirilebilir)
            if (userFraudCount[submission.user] >= 3) {
                isBlacklisted[submission.user] = true;
                emit UserBlacklisted(submission.user, "3 fraud warning exceeded");
            }
        }

        emit SubmissionRejected(submissionId, submission.user, reason, msg.sender);
    }

    /**
     * @notice Toplu onay (verimlilik için)
     */
    function batchApprove(uint256[] calldata submissionIds) 
        external 
        onlyRole(MUNICIPALITY_STAFF_ROLE)
        whenNotPaused
    {
        for (uint256 i = 0; i < submissionIds.length; i++) {
            PendingSubmission storage submission = pendingSubmissions[submissionIds[i]];
            
            if (submission.user != address(0) && 
                !submission.approved && 
                !submission.rejected &&
                !isBlacklisted[submission.user]) 
            {
                submission.approved = true;
                submission.approvedBy = msg.sender;

                uint256 reward = calculateReward(submission.wasteType, submission.amount);
                if (reward > 0) {
                    beltToken.mint(submission.user, reward);
                    emit SubmissionApproved(submissionIds[i], submission.user, reward, msg.sender);
                }
            }
        }
    }

    // ==============================
    // LEGACY FUNCTION (backwards compatibility)
    // ==============================
    
    /**
     * @notice QR doğrulaması sonrası direkt ödül (eski sistem)
     * @dev Backend / belediye tarafından çağrılır - staff rolü gerekli
     */
    function rewardRecycling(
        address user,
        WasteType wasteType,
        uint256 baseAmount,
        string calldata qrHash
    ) 
        external 
        onlyRole(MUNICIPALITY_STAFF_ROLE) 
        whenNotPaused 
        validAddress(user)
        notBlacklisted(user)
        nonReentrant
    {
        require(baseAmount > 0, "Amount must be > 0");
        require(baseAmount <= MAX_AMOUNT_PER_SUBMISSION, "Amount exceeds maximum");
        require(bytes(qrHash).length > 0, "QR hash required");
        require(!usedQrHashes[qrHash], "QR hash already used");

        usedQrHashes[qrHash] = true;

        uint256 reward = calculateReward(wasteType, baseAmount);
        require(reward > 0, "Reward calculation failed");

        beltToken.mint(user, reward);

        emit SubmissionApproved(0, user, reward, msg.sender);
    }

    // ==============================
    // UTILITY FUNCTIONS
    // ==============================

    /**
     * @notice Token ödülü hesapla
     * @param wasteType Atık türü
     * @param amount Miktar (kg veya adet)
     * @return Token miktarı
     */
    function calculateReward(WasteType wasteType, uint256 amount) 
        public 
        view 
        returns (uint256) 
    {
        uint256 rate = tokenRatePerUnit[wasteType];
        // rate 10x multiplier ile saklandığı için 10'a böl
        return (amount * rate) / 10;
    }

    /**
     * @notice Bekleyen submission'ları getir
     */
    function getPendingSubmissions(uint256 startId, uint256 count) 
        external 
        view 
        returns (uint256[] memory ids, address[] memory users, uint256[] memory amounts)
    {
        uint256 endId = startId + count;
        if (endId > submissionCounter) endId = submissionCounter + 1;
        
        uint256 pendingCount = 0;
        for (uint256 i = startId; i < endId; i++) {
            if (!pendingSubmissions[i].approved && !pendingSubmissions[i].rejected) {
                pendingCount++;
            }
        }
        
        ids = new uint256[](pendingCount);
        users = new address[](pendingCount);
        amounts = new uint256[](pendingCount);
        
        uint256 j = 0;
        for (uint256 i = startId; i < endId && j < pendingCount; i++) {
            if (!pendingSubmissions[i].approved && !pendingSubmissions[i].rejected) {
                ids[j] = i;
                users[j] = pendingSubmissions[i].user;
                amounts[j] = pendingSubmissions[i].amount;
                j++;
            }
        }
        
        return (ids, users, amounts);
    }

    /**
     * @notice Kullanıcının submission'larını getir
     */
    function getUserSubmissions(address user) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return userSubmissions[user];
    }

    /**
     * @notice Tüm atık türleri için token oranlarını getir
     */
    function getAllTokenRates() 
        external 
        view 
        returns (
            uint256 plastic,
            uint256 glass,
            uint256 metal,
            uint256 paper,
            uint256 electronic
        ) 
    {
        return (
            tokenRatePerUnit[WasteType.Plastic] / 10,
            tokenRatePerUnit[WasteType.Glass] / 10,
            tokenRatePerUnit[WasteType.Metal] / 10,
            tokenRatePerUnit[WasteType.Paper] / 10,
            tokenRatePerUnit[WasteType.Electronic] / 10
        );
    }

    // ==============================
    // ADMIN FUNCTIONS
    // ==============================

    /**
     * @notice Token rate güncelle
     */
    function setTokenRate(WasteType wasteType, uint256 newRate) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newRate > 0, "Rate must be > 0");
        require(newRate <= 1000, "Rate too high"); // Max 100 token/unit
        
        tokenRatePerUnit[wasteType] = newRate;
        emit TokenRateUpdated(wasteType, newRate);
    }

    /**
     * @notice Kullanıcıyı blacklist'ten çıkar
     */
    function removeFromBlacklist(address user) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE)
        validAddress(user)
    {
        isBlacklisted[user] = false;
        userFraudCount[user] = 0;
    }

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
     * @notice QR hash'in kullanılıp kullanılmadığını kontrol et
     */
    function isQrHashUsed(string calldata qrHash) external view returns (bool) {
        return usedQrHashes[qrHash];
    }
    
    // ==============================
    // RECYCLING FRAUD BAN (CRITICAL)
    // ==============================
    
    bytes32 public constant RECYCLING_INSPECTOR_ROLE = keccak256("RECYCLING_INSPECTOR_ROLE");
    
    // Geri dönüşüm ödüllerinden kalıcı yasaklı kullanıcılar
    mapping(address => bool) public recyclingBanned;
    
    event RecyclingFraudConfirmed(address indexed user, address confirmedBy, string reason);
    event RecyclingBanApplied(address indexed user);
    event RecyclingBanRemoved(address indexed user);
    
    /**
     * @notice Geri dönüşüm fraud onayı - KALICI YASAK
     * @param user Kullanıcı adresi
     * @param reason Yasak sebebi
     * @dev Fraud yapan kullanıcı bir daha token kazanamaz
     */
    function confirmRecyclingFraud(address user, string calldata reason) 
        external 
    {
        require(user != address(0), "Invalid address");
        require(
            hasRole(RECYCLING_INSPECTOR_ROLE, msg.sender) ||
            hasRole(MUNICIPALITY_STAFF_ROLE, msg.sender) ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Not authorized recycling inspector"
        );
        
        recyclingBanned[user] = true;
        isBlacklisted[user] = true;
        userFraudCount[user]++;
        
        emit RecyclingFraudConfirmed(user, msg.sender, reason);
        emit RecyclingBanApplied(user);
    }
    
    /**
     * @notice Yasak kaldır (sadece admin)
     */
    function removeRecyclingBan(address user) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(user != address(0), "Invalid address");
        require(recyclingBanned[user], "User not banned");
        
        recyclingBanned[user] = false;
        
        emit RecyclingBanRemoved(user);
    }
    
    /**
     * @notice Kullanıcının ödül alıp alamayacağını kontrol et
     * @dev Reward fonksiyonlarında kullanılmalı
     */
    function canReceiveReward(address user) external view returns (bool) {
        return !recyclingBanned[user] && !isBlacklisted[user];
    }
}
