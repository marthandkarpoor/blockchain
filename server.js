require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { ethers } = require("ethers");
const { address, abi } = require("./contract.json");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "http://127.0.0.1:7545");
const contract = new ethers.Contract(address, abi, provider);

// Off-chain storage (MongoDB): full certificate. On-chain: only its hash.
const Credential = mongoose.model("Credential", new mongoose.Schema({
  canonical: String,            // exact JSON string that was hashed
  hash: { type: String, unique: true },
  issuer: String, student: String, studentName: String, degree: String,
  txHash: String,
  createdAt: { type: Date, default: Date.now },
}));

const hashOf = (canonical) => ethers.keccak256(ethers.toUtf8Bytes(canonical));
const view = (d) => ({ id: d._id, hash: d.hash, txHash: d.txHash, ...JSON.parse(d.canonical) });

const app = express();
app.use(cors());
app.use(express.json());

// 1) University prepares a credential: backend stores it and returns the hash to anchor on-chain
app.post("/api/credentials", async (req, res) => {
  try {
    const { issuer, studentAddress, studentName, degree, branch, marks, cgpa, year } = req.body;
    if (!ethers.isAddress(issuer) || !ethers.isAddress(studentAddress))
      return res.status(400).json({ error: "Invalid wallet address" });
    if (Number(await contract.roles(issuer)) !== 1)
      return res.status(403).json({ error: "Issuer is not an accredited university" });

    const canonical = JSON.stringify({           // fixed key order => deterministic hash
      issuer, student: studentAddress, studentName, degree, branch, marks, cgpa, year,
      salt: crypto.randomBytes(16).toString("hex"),
    });
    const doc = await Credential.create({
      canonical, hash: hashOf(canonical), issuer, student: studentAddress, studentName, degree,
    });
    res.json({ id: doc._id, hash: doc.hash });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// After the MetaMask transaction is mined
app.patch("/api/credentials/:id/anchor", async (req, res) => {
  await Credential.findByIdAndUpdate(req.params.id, { txHash: req.body.txHash });
  res.json({ ok: true });
});

// 2) Student wallet: list own degrees
app.get("/api/credentials", async (req, res) => {
  const list = await Credential.find({
    student: new RegExp(`^${req.query.student}$`, "i"), txHash: { $exists: true },
  });
  res.json(list.map(view));
});

app.get("/api/credentials/:id", async (req, res) => {
  const d = await Credential.findById(req.params.id).catch(() => null);
  d ? res.json(view(d)) : res.status(404).json({ error: "Not found" });
});

// 3) Employer verification -> "Verified" or "Rejected Fake degree"
app.get("/api/verify/:id", async (req, res) => {
  try {
    const d = await Credential.findById(req.params.id).catch(() => null);
    if (!d) return res.json({ valid: false, reason: "Credential not found (possible FAKE degree)" });

    const hash = hashOf(d.canonical);
    if (hash !== d.hash)
      return res.json({ valid: false, reason: "Record was tampered with (hash mismatch)" });

    const [valid, issuer] = await contract.verifyDegree(hash);
    if (issuer === ethers.ZeroAddress)
      return res.json({ valid: false, reason: "Degree hash not on blockchain (FAKE degree)" });
    if (!valid) {
      const { revoked } = await contract.degrees(hash);
      return res.json({ valid: false, reason: revoked ? "Degree has been REVOKED" : "Issuer no longer accredited" });
    }
    res.json({ valid: true, reason: "Hash found on blockchain, issuer accredited, not revoked", credential: view(d) });
  } catch (e) { res.status(500).json({ valid: false, reason: e.message }); }
});

mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/degreedid").then(() =>
  app.listen(process.env.PORT || 5000, () => console.log("API on :" + (process.env.PORT || 5000))));
