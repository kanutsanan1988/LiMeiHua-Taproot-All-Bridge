/**
 * LiMeiHua Taproot All Bridge - Backend Server
 * 
 * ชุดซอฟต์แวร์ชุดนี้ มีไว้เพื่อเป็นโครงสร้างพื้นฐานทางการเงินยุคใหม่
 * เพื่อรองรับการไหลของเงินจำนวนมหาศาลของท่านผู้เฒ่าหลี่เหมยฮัว หรือ LiMeiHua Grand Mother
 * และ source code นี้สร้างโดย Mr.Kanutsanan Pongpanna (นายคณัสนันท์ พงษ์พันนา)
 * URL: https://chatgpt.com/g/g-68d289535dec81919445deb9830f2d8e-kanutsanan-pongpanna
 */

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import axios from 'axios';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ============ Configuration ============

const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY';
const BITCOIN_RPC_URL = process.env.BITCOIN_RPC_URL || 'http://localhost:8080';
const BRIDGE_CONTRACT_ADDRESS = process.env.BRIDGE_CONTRACT_ADDRESS;
const BRIDGE_CONTRACT_ABI = JSON.parse(process.env.BRIDGE_CONTRACT_ABI || '[]');
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Initialize providers
const ethereumProvider = new ethers.JsonRpcProvider(ETHEREUM_RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, ethereumProvider);
const bridgeContract = new ethers.Contract(BRIDGE_CONTRACT_ADDRESS, BRIDGE_CONTRACT_ABI, signer);

// ============ Data Storage (In-memory for demo) ============

const bridgeTransactions = new Map();
const pendingBridges = new Map();

// ============ Routes ============

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'LiMeiHua Taproot All Bridge',
        version: '1.0.0'
    });
});

/**
 * Get bridge status
 */
app.get('/api/bridge/status', async (req, res) => {
    try {
        const totalTransactions = bridgeTransactions.size;
        const pendingTransactions = pendingBridges.size;

        res.json({
            success: true,
            status: 'active',
            totalTransactions,
            pendingTransactions,
            ethereumNetwork: 'sepolia',
            bitcoinNetwork: 'testnet',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get supported tokens
 */
app.get('/api/bridge/tokens', async (req, res) => {
    try {
        const supportedTokens = [
            {
                address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
                symbol: 'DAI',
                name: 'Dai Stablecoin',
                decimals: 18,
                assetId: 'taproot_dai_001'
            },
            {
                address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
                symbol: 'USDC',
                name: 'USD Coin',
                decimals: 6,
                assetId: 'taproot_usdc_001'
            },
            {
                address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
                symbol: 'USDT',
                name: 'Tether USD',
                decimals: 6,
                assetId: 'taproot_usdt_001'
            }
        ];

        res.json({
            success: true,
            tokens: supportedTokens,
            count: supportedTokens.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Estimate bridge fee
 */
app.post('/api/bridge/estimate-fee', async (req, res) => {
    try {
        const { amount, token } = req.body;

        if (!amount || !token) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: amount, token'
            });
        }

        // Calculate fee (0.25%)
        const feePercentage = 0.0025;
        const fee = BigInt(Math.floor(Number(amount) * feePercentage));
        const amountAfterFee = BigInt(amount) - fee;

        // Estimate gas cost
        const gasEstimate = 150000; // Approximate gas for lock operation
        const gasPrice = await ethereumProvider.getGasPrice();
        const gasCost = gasEstimate * Number(gasPrice);

        res.json({
            success: true,
            amount: amount.toString(),
            bridgeFee: fee.toString(),
            feePercentage: '0.25%',
            amountAfterFee: amountAfterFee.toString(),
            estimatedGas: gasEstimate,
            estimatedGasCost: gasCost.toString(),
            totalCost: (Number(fee) + gasCost).toString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Initiate bridge from Ethereum to Bitcoin
 */
app.post('/api/bridge/lock-tokens', async (req, res) => {
    try {
        const { tokenAddress, amount, bitcoinAddress, userAddress } = req.body;

        if (!tokenAddress || !amount || !bitcoinAddress || !userAddress) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Validate Bitcoin address
        if (!isValidBitcoinAddress(bitcoinAddress)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Bitcoin address'
            });
        }

        // Create transaction ID
        const txId = `bridge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Store pending bridge
        pendingBridges.set(txId, {
            tokenAddress,
            amount,
            bitcoinAddress,
            userAddress,
            status: 'pending',
            createdAt: new Date().toISOString(),
            ethereumTxHash: null,
            bitcoinTxHash: null
        });

        // Simulate calling the smart contract
        // In production, this would actually call bridgeContract.lockTokens()
        const simulatedTxHash = `0x${Math.random().toString(16).substr(2)}`;

        // Update with Ethereum tx hash
        const bridge = pendingBridges.get(txId);
        bridge.ethereumTxHash = simulatedTxHash;
        bridge.status = 'locked';

        // Store in completed transactions
        bridgeTransactions.set(txId, bridge);

        res.json({
            success: true,
            txId,
            status: 'locked',
            ethereumTxHash: simulatedTxHash,
            amount,
            bitcoinAddress,
            message: 'Tokens locked successfully. Waiting for Bitcoin confirmation...'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get bridge transaction status
 */
app.get('/api/bridge/status/:txId', (req, res) => {
    try {
        const { txId } = req.params;

        const transaction = bridgeTransactions.get(txId);
        if (!transaction) {
            return res.status(404).json({
                success: false,
                error: 'Transaction not found'
            });
        }

        res.json({
            success: true,
            txId,
            ...transaction
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get user's bridge history
 */
app.get('/api/bridge/history/:userAddress', (req, res) => {
    try {
        const { userAddress } = req.params;

        const userTransactions = Array.from(bridgeTransactions.values())
            .filter(tx => tx.userAddress.toLowerCase() === userAddress.toLowerCase());

        res.json({
            success: true,
            userAddress,
            transactions: userTransactions,
            count: userTransactions.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Webhook for Bitcoin confirmation
 */
app.post('/api/bridge/confirm-bitcoin', async (req, res) => {
    try {
        const { txId, bitcoinTxHash } = req.body;

        if (!txId || !bitcoinTxHash) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        const transaction = bridgeTransactions.get(txId);
        if (!transaction) {
            return res.status(404).json({
                success: false,
                error: 'Transaction not found'
            });
        }

        // Update transaction status
        transaction.bitcoinTxHash = bitcoinTxHash;
        transaction.status = 'confirmed';
        transaction.confirmedAt = new Date().toISOString();

        res.json({
            success: true,
            txId,
            status: 'confirmed',
            bitcoinTxHash,
            message: 'Bitcoin transaction confirmed'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get bridge statistics
 */
app.get('/api/bridge/stats', (req, res) => {
    try {
        const allTransactions = Array.from(bridgeTransactions.values());
        const confirmedTransactions = allTransactions.filter(tx => tx.status === 'confirmed');
        const pendingTransactions = allTransactions.filter(tx => tx.status === 'pending' || tx.status === 'locked');

        const totalVolume = allTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

        res.json({
            success: true,
            stats: {
                totalTransactions: allTransactions.length,
                confirmedTransactions: confirmedTransactions.length,
                pendingTransactions: pendingTransactions.length,
                totalVolume: totalVolume.toString(),
                averageTransactionSize: (totalVolume / (allTransactions.length || 1)).toString()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============ Helper Functions ============

/**
 * Validate Bitcoin address
 */
function isValidBitcoinAddress(address) {
    // Simple validation - in production, use more robust validation
    return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/.test(address);
}

// ============ Error Handling ============

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// ============ Start Server ============

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║   LiMeiHua Taproot All Bridge - Backend Server             ║
║   Version: 1.0.0                                           ║
║   Status: Running                                          ║
╚════════════════════════════════════════════════════════════╝
    `);
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});

export default app;
