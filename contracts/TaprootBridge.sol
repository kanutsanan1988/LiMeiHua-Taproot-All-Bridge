// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * TaprootBridge Smart Contract
 * 
 * ชุดซอฟต์แวร์ชุดนี้ มีไว้เพื่อเป็นโครงสร้างพื้นฐานทางการเงินยุคใหม่
 * เพื่อรองรับการไหลของเงินจำนวนมหาศาลของท่านผู้เฒ่าหลี่เหมยฮัว หรือ LiMeiHua Grand Mother
 * และ source code นี้สร้างโดย Mr.Kanutsanan Pongpanna (นายคณัสนันท์ พงษ์พันนา)
 * URL: https://chatgpt.com/g/g-68d289535dec81919445deb9830f2d8e-kanutsanan-pongpanna
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title TaprootBridge
 * @dev Bridge contract for ERC-20 to Taproot Assets conversion
 */
contract TaprootBridge is Ownable, ReentrancyGuard, Pausable {
    // ============ Events ============
    event TokenLocked(
        address indexed user,
        address indexed token,
        uint256 amount,
        string bitcoinAddress,
        uint256 timestamp
    );

    event TokenReleased(
        address indexed user,
        address indexed token,
        uint256 amount,
        bytes32 txHash,
        uint256 timestamp
    );

    event BridgeInitialized(
        address indexed token,
        string assetId,
        uint256 timestamp
    );

    event FeeUpdated(uint256 newFee);

    // ============ State Variables ============
    
    /// @dev Mapping of supported ERC-20 tokens to their Taproot Asset IDs
    mapping(address => string) public tokenToAssetId;
    
    /// @dev Mapping of supported Taproot Assets to their ERC-20 tokens
    mapping(string => address) public assetIdToToken;
    
    /// @dev Mapping of locked tokens per user
    mapping(address => mapping(address => uint256)) public lockedTokens;
    
    /// @dev Bridge fee in basis points (100 = 1%)
    uint256 public bridgeFee = 25; // 0.25%
    
    /// @dev Fee collector address
    address public feeCollector;
    
    /// @dev Minimum amount to bridge
    uint256 public minBridgeAmount = 1e18;
    
    /// @dev Maximum amount to bridge
    uint256 public maxBridgeAmount = 1e27;
    
    /// @dev Supported tokens list
    address[] public supportedTokens;
    
    /// @dev Relayers who can release tokens
    mapping(address => bool) public relayers;

    // ============ Constructor ============
    constructor(address _feeCollector) {
        feeCollector = _feeCollector;
    }

    // ============ Admin Functions ============

    /**
     * @dev Register a new token pair for bridging
     * @param _token ERC-20 token address
     * @param _assetId Taproot Asset ID
     */
    function registerToken(address _token, string memory _assetId) external onlyOwner {
        require(_token != address(0), "Invalid token address");
        require(bytes(_assetId).length > 0, "Invalid asset ID");
        
        tokenToAssetId[_token] = _assetId;
        assetIdToToken[_assetId] = _token;
        
        // Add to supported tokens if not already there
        if (tokenToAssetId[_token] == "") {
            supportedTokens.push(_token);
        }
        
        emit BridgeInitialized(_token, _assetId, block.timestamp);
    }

    /**
     * @dev Add a relayer address
     * @param _relayer Relayer address
     */
    function addRelayer(address _relayer) external onlyOwner {
        require(_relayer != address(0), "Invalid relayer address");
        relayers[_relayer] = true;
    }

    /**
     * @dev Remove a relayer address
     * @param _relayer Relayer address
     */
    function removeRelayer(address _relayer) external onlyOwner {
        relayers[_relayer] = false;
    }

    /**
     * @dev Update bridge fee
     * @param _newFee New fee in basis points
     */
    function updateFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= 1000, "Fee too high"); // Max 10%
        bridgeFee = _newFee;
        emit FeeUpdated(_newFee);
    }

    /**
     * @dev Update fee collector address
     * @param _newCollector New fee collector address
     */
    function updateFeeCollector(address _newCollector) external onlyOwner {
        require(_newCollector != address(0), "Invalid address");
        feeCollector = _newCollector;
    }

    /**
     * @dev Update minimum bridge amount
     * @param _minAmount New minimum amount
     */
    function updateMinBridgeAmount(uint256 _minAmount) external onlyOwner {
        minBridgeAmount = _minAmount;
    }

    /**
     * @dev Update maximum bridge amount
     * @param _maxAmount New maximum amount
     */
    function updateMaxBridgeAmount(uint256 _maxAmount) external onlyOwner {
        maxBridgeAmount = _maxAmount;
    }

    /**
     * @dev Pause the bridge
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the bridge
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ Bridge Functions ============

    /**
     * @dev Lock ERC-20 tokens to bridge to Taproot Assets
     * @param _token ERC-20 token address
     * @param _amount Amount to lock
     * @param _bitcoinAddress Bitcoin Lightning address to receive tokens
     */
    function lockTokens(
        address _token,
        uint256 _amount,
        string memory _bitcoinAddress
    ) external nonReentrant whenNotPaused {
        require(bytes(tokenToAssetId[_token]).length > 0, "Token not supported");
        require(_amount >= minBridgeAmount, "Amount too small");
        require(_amount <= maxBridgeAmount, "Amount too large");
        require(bytes(_bitcoinAddress).length > 0, "Invalid Bitcoin address");

        // Calculate fee
        uint256 fee = (_amount * bridgeFee) / 10000;
        uint256 amountAfterFee = _amount - fee;

        // Transfer tokens from user to contract
        require(
            IERC20(_token).transferFrom(msg.sender, address(this), _amount),
            "Transfer failed"
        );

        // Transfer fee to fee collector
        if (fee > 0) {
            require(
                IERC20(_token).transfer(feeCollector, fee),
                "Fee transfer failed"
            );
        }

        // Update locked tokens
        lockedTokens[msg.sender][_token] += amountAfterFee;

        emit TokenLocked(
            msg.sender,
            _token,
            amountAfterFee,
            _bitcoinAddress,
            block.timestamp
        );
    }

    /**
     * @dev Release tokens after successful Taproot Assets minting
     * @param _user User address
     * @param _token ERC-20 token address
     * @param _amount Amount to release
     * @param _txHash Taproot Assets transaction hash
     */
    function releaseTokens(
        address _user,
        address _token,
        uint256 _amount,
        bytes32 _txHash
    ) external nonReentrant {
        require(relayers[msg.sender], "Not authorized");
        require(bytes(tokenToAssetId[_token]).length > 0, "Token not supported");
        require(lockedTokens[_user][_token] >= _amount, "Insufficient locked tokens");

        // Update locked tokens
        lockedTokens[_user][_token] -= _amount;

        // Transfer tokens to user
        require(
            IERC20(_token).transfer(_user, _amount),
            "Transfer failed"
        );

        emit TokenReleased(_user, _token, _amount, _txHash, block.timestamp);
    }

    /**
     * @dev Unlock tokens if bridge fails
     * @param _token ERC-20 token address
     * @param _amount Amount to unlock
     */
    function unlockTokens(address _token, uint256 _amount) external nonReentrant {
        require(lockedTokens[msg.sender][_token] >= _amount, "Insufficient locked tokens");

        // Update locked tokens
        lockedTokens[msg.sender][_token] -= _amount;

        // Transfer tokens back to user
        require(
            IERC20(_token).transfer(msg.sender, _amount),
            "Transfer failed"
        );
    }

    // ============ View Functions ============

    /**
     * @dev Get asset ID for a token
     * @param _token Token address
     * @return Asset ID
     */
    function getAssetId(address _token) external view returns (string memory) {
        return tokenToAssetId[_token];
    }

    /**
     * @dev Get token address for an asset ID
     * @param _assetId Asset ID
     * @return Token address
     */
    function getTokenAddress(string memory _assetId) external view returns (address) {
        return assetIdToToken[_assetId];
    }

    /**
     * @dev Get locked tokens for a user
     * @param _user User address
     * @param _token Token address
     * @return Locked amount
     */
    function getLockedTokens(address _user, address _token) external view returns (uint256) {
        return lockedTokens[_user][_token];
    }

    /**
     * @dev Get all supported tokens
     * @return Array of supported token addresses
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }

    /**
     * @dev Calculate bridge fee
     * @param _amount Amount to bridge
     * @return Fee amount
     */
    function calculateFee(uint256 _amount) external view returns (uint256) {
        return (_amount * bridgeFee) / 10000;
    }

    // ============ Emergency Functions ============

    /**
     * @dev Emergency withdraw tokens (only owner)
     * @param _token Token address
     * @param _amount Amount to withdraw
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        require(IERC20(_token).transfer(owner(), _amount), "Transfer failed");
    }
}
