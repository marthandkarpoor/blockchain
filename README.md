# Blockchain-Based Decentralized Identity Management for Degree Verification

Stack: React + Vite | Node/Express | Ethereum (Ganache) | Solidity | MetaMask | MongoDB

## Prerequisites
Node.js 18+, Ganache (GUI or `npx ganache -p 7545 -i 1337`), MongoDB running locally, MetaMask browser extension.

## 1. Blockchain (from project root)
    npm install
    npx hardhat compile
    npm run deploy          # prints contract + demo account addresses, writes contract.json

## 2. Backend
    cd backend && npm install
    cp .env.example .env
    npm start

## 3. Frontend
    cd frontend && npm install
    npm run dev             # http://localhost:5173

## 4. MetaMask setup
- Add network: RPC `http://127.0.0.1:7545`, Chain ID `1337`, symbol ETH.
- Import Ganache accounts using their private keys (key icon in Ganache):
  account 0 = Regulator, 1 = University, 2 = Student, 3 = Employer (registered by deploy script).

## 5. Demo flow (matches the project diagram)
1. **University** (acct 1): enter student's wallet (acct 2) + degree details -> Sign & Issue (MetaMask popup). Hash stored on-chain, full record in MongoDB.
2. **Student** (acct 2): Load my degrees -> copy the Credential ID.
3. **Employer** (acct 3): paste ID -> Verify -> **Verified** (job/admission).
4. **Rejected cases**: random/unknown ID, edited record in MongoDB (hash mismatch), or University (acct 1) revokes the ID, then verify again.
5. New users (no role) see "Register as Student/Employer"; Regulator (acct 0) can accredit more universities.
