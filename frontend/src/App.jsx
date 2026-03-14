/**
 * LiMeiHua Taproot All Bridge - Frontend App
 * 
 * ชุดซอฟต์แวร์ชุดนี้ มีไว้เพื่อเป็นโครงสร้างพื้นฐานทางการเงินยุคใหม่
 * เพื่อรองรับการไหลของเงินจำนวนมหาศาลของท่านผู้เฒ่าหลี่เหมยฮัว หรือ LiMeiHua Grand Mother
 * และ source code นี้สร้างโดย Mr.Kanutsanan Pongpanna (นายคณัสนันท์ พงษ์พันนา)
 * URL: https://chatgpt.com/g/g-68d289535dec81919445deb9830f2d8e-kanutsanan-pongpanna
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

/**
 * Main Bridge Application Component
 */
function App() {
    const [account, setAccount] = useState(null);
    const [tokens, setTokens] = useState([]);
    const [selectedToken, setSelectedToken] = useState(null);
    const [amount, setAmount] = useState('');
    const [bitcoinAddress, setBitcoinAddress] = useState('');
    const [fee, setFee] = useState(null);
    const [loading, setLoading] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [activeTab, setActiveTab] = useState('bridge');
    const [stats, setStats] = useState(null);

    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

    // ============ Effects ============

    useEffect(() => {
        loadTokens();
        loadStats();
    }, []);

    useEffect(() => {
        if (account) {
            loadTransactions();
        }
    }, [account]);

    useEffect(() => {
        if (amount && selectedToken) {
            estimateFee();
        }
    }, [amount, selectedToken]);

    // ============ API Calls ============

    const loadTokens = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/bridge/tokens`);
            setTokens(response.data.tokens);
            if (response.data.tokens.length > 0) {
                setSelectedToken(response.data.tokens[0]);
            }
        } catch (error) {
            console.error('Error loading tokens:', error);
        }
    };

    const loadStats = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/bridge/stats`);
            setStats(response.data.stats);
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const loadTransactions = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/bridge/history/${account}`);
            setTransactions(response.data.transactions);
        } catch (error) {
            console.error('Error loading transactions:', error);
        }
    };

    const estimateFee = async () => {
        if (!amount || !selectedToken) return;

        try {
            const response = await axios.post(`${API_URL}/api/bridge/estimate-fee`, {
                amount: amount,
                token: selectedToken.address
            });
            setFee(response.data);
        } catch (error) {
            console.error('Error estimating fee:', error);
        }
    };

    const connectWallet = async () => {
        try {
            if (window.ethereum) {
                const accounts = await window.ethereum.request({
                    method: 'eth_requestAccounts'
                });
                setAccount(accounts[0]);
            } else {
                alert('Please install MetaMask');
            }
        } catch (error) {
            console.error('Error connecting wallet:', error);
        }
    };

    const handleBridge = async (e) => {
        e.preventDefault();

        if (!account) {
            alert('Please connect your wallet');
            return;
        }

        if (!selectedToken || !amount || !bitcoinAddress) {
            alert('Please fill in all fields');
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post(`${API_URL}/api/bridge/lock-tokens`, {
                tokenAddress: selectedToken.address,
                amount: amount,
                bitcoinAddress: bitcoinAddress,
                userAddress: account
            });

            if (response.data.success) {
                alert(`✓ Bridge initiated!\nTransaction ID: ${response.data.txId}`);
                setAmount('');
                setBitcoinAddress('');
                loadTransactions();
            }
        } catch (error) {
            console.error('Error bridging tokens:', error);
            alert('Error: ' + error.response?.data?.error || error.message);
        } finally {
            setLoading(false);
        }
    };

    // ============ Render ============

    return (
        <div className="app">
            <header className="header">
                <div className="header-content">
                    <h1>⚡ LiMeiHua Taproot All Bridge</h1>
                    <p>Bridge ERC-20 ↔ Taproot Assets</p>
                </div>
                <button
                    className="connect-btn"
                    onClick={connectWallet}
                >
                    {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect Wallet'}
                </button>
            </header>

            <div className="container">
                {/* Tabs */}
                <div className="tabs">
                    <button
                        className={`tab ${activeTab === 'bridge' ? 'active' : ''}`}
                        onClick={() => setActiveTab('bridge')}
                    >
                        Bridge
                    </button>
                    <button
                        className={`tab ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        History
                    </button>
                    <button
                        className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
                        onClick={() => setActiveTab('stats')}
                    >
                        Statistics
                    </button>
                </div>

                {/* Bridge Tab */}
                {activeTab === 'bridge' && (
                    <div className="tab-content">
                        <div className="bridge-card">
                            <h2>Bridge Tokens</h2>
                            <form onSubmit={handleBridge}>
                                {/* Token Selection */}
                                <div className="form-group">
                                    <label>Select Token</label>
                                    <select
                                        value={selectedToken?.address || ''}
                                        onChange={(e) => {
                                            const token = tokens.find(t => t.address === e.target.value);
                                            setSelectedToken(token);
                                        }}
                                    >
                                        {tokens.map(token => (
                                            <option key={token.address} value={token.address}>
                                                {token.symbol} - {token.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Amount */}
                                <div className="form-group">
                                    <label>Amount</label>
                                    <input
                                        type="number"
                                        placeholder="Enter amount"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        step="0.01"
                                        min="0"
                                    />
                                </div>

                                {/* Bitcoin Address */}
                                <div className="form-group">
                                    <label>Bitcoin Lightning Address</label>
                                    <input
                                        type="text"
                                        placeholder="Enter Bitcoin address"
                                        value={bitcoinAddress}
                                        onChange={(e) => setBitcoinAddress(e.target.value)}
                                    />
                                </div>

                                {/* Fee Display */}
                                {fee && (
                                    <div className="fee-info">
                                        <div className="fee-row">
                                            <span>Bridge Fee:</span>
                                            <strong>{fee.bridgeFee} ({fee.feePercentage})</strong>
                                        </div>
                                        <div className="fee-row">
                                            <span>Amount After Fee:</span>
                                            <strong>{fee.amountAfterFee}</strong>
                                        </div>
                                        <div className="fee-row">
                                            <span>Estimated Gas:</span>
                                            <strong>{fee.estimatedGas} gas</strong>
                                        </div>
                                    </div>
                                )}

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    className="submit-btn"
                                    disabled={loading || !account}
                                >
                                    {loading ? 'Processing...' : 'Bridge Tokens'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                    <div className="tab-content">
                        <div className="history-card">
                            <h2>Transaction History</h2>
                            {transactions.length === 0 ? (
                                <p className="empty-state">No transactions yet</p>
                            ) : (
                                <div className="transactions-list">
                                    {transactions.map((tx, idx) => (
                                        <div key={idx} className="transaction-item">
                                            <div className="tx-header">
                                                <span className="tx-id">{tx.txId}</span>
                                                <span className={`tx-status ${tx.status}`}>{tx.status}</span>
                                            </div>
                                            <div className="tx-details">
                                                <p><strong>Amount:</strong> {tx.amount}</p>
                                                <p><strong>Bitcoin Address:</strong> {tx.bitcoinAddress}</p>
                                                <p><strong>Created:</strong> {new Date(tx.createdAt).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Statistics Tab */}
                {activeTab === 'stats' && (
                    <div className="tab-content">
                        <div className="stats-card">
                            <h2>Bridge Statistics</h2>
                            {stats ? (
                                <div className="stats-grid">
                                    <div className="stat-box">
                                        <div className="stat-value">{stats.totalTransactions}</div>
                                        <div className="stat-label">Total Transactions</div>
                                    </div>
                                    <div className="stat-box">
                                        <div className="stat-value">{stats.confirmedTransactions}</div>
                                        <div className="stat-label">Confirmed</div>
                                    </div>
                                    <div className="stat-box">
                                        <div className="stat-value">{stats.pendingTransactions}</div>
                                        <div className="stat-label">Pending</div>
                                    </div>
                                    <div className="stat-box">
                                        <div className="stat-value">{stats.totalVolume}</div>
                                        <div className="stat-label">Total Volume</div>
                                    </div>
                                </div>
                            ) : (
                                <p>Loading statistics...</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <footer className="footer">
                <p>LiMeiHua Taproot All Bridge v1.0.0 | Created by Mr. Kanutsanan Pongpanna</p>
            </footer>
        </div>
    );
}

export default App;
