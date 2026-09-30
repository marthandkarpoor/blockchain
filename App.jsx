import { useState, useEffect } from "react";
import { BrowserProvider, Contract } from "ethers";
import { address, abi } from "./contract.json";
import "./App.css";

const API = "http://localhost:5000/api";
const ROLES = ["Not registered", "University", "Student", "Employer"];
const post = (url, method, body) =>
  fetch(API + url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

export default function App() {
  const [acct, setAcct] = useState("");
  const [role, setRole] = useState(0);
  const [isReg, setIsReg] = useState(false);
  const [c, setC] = useState(null);
  const [msg, setMsg] = useState("");
  const [f, setF] = useState({ studentAddress: "", studentName: "", degree: "B.Tech", branch: "", marks: "", cgpa: "", year: 2026 });
  const [creds, setCreds] = useState([]);
  const [vid, setVid] = useState("");
  const [result, setResult] = useState(null);
  const [uni, setUni] = useState("");
  const [revId, setRevId] = useState("");

  const run = async (fn) => {
    try { setMsg("Waiting for MetaMask / network..."); await fn(); }
    catch (e) { setMsg("Error: " + (e.shortMessage || e.message)); }
  };

  async function connect() {
    if (!window.ethereum) return setMsg("Please install MetaMask");
    await window.ethereum.request({ method: "eth_requestAccounts" });
    const s = await new BrowserProvider(window.ethereum).getSigner();
    const ct = new Contract(address, abi, s);
    const a = await s.getAddress();
    setC(ct); setAcct(a);
    setRole(Number(await ct.roles(a)));
    setIsReg((await ct.regulator()).toLowerCase() === a.toLowerCase());
    setCreds([]); setResult(null); setMsg("");
  }
  useEffect(() => {
    window.ethereum?.on("accountsChanged", connect);
    return () => window.ethereum?.removeListener("accountsChanged", connect);
  }, []);

  const register = (r) => run(async () => {
    await (await c.registerSelf(r, "did:ethr:" + acct)).wait();
    await connect(); setMsg("Registered on DID registry");
  });

  const accredit = () => run(async () => {
    await (await c.accreditUniversity(uni, "did:ethr:" + uni)).wait();
    setMsg("University accredited: " + uni);
  });

  const issue = () => run(async () => {
    const r = await post("/credentials", "POST", { ...f, issuer: acct });
    if (r.error) throw new Error(r.error);
    const tx = await c.issueDegree(r.hash, f.studentAddress);   // MetaMask signs = university signature
    await tx.wait();
    await post(`/credentials/${r.id}/anchor`, "PATCH", { txHash: tx.hash });
    setMsg(`Degree signed & anchored on-chain. Credential ID: ${r.id}`);
  });

  const revoke = () => run(async () => {
    const d = await fetch(`${API}/credentials/${revId}`).then((r) => r.json());
    await (await c.revokeDegree(d.hash)).wait();
    setMsg("Degree revoked on-chain");
  });

  const loadWallet = () => run(async () => {
    setCreds(await fetch(`${API}/credentials?student=${acct}`).then((r) => r.json()));
    setMsg("");
  });

  const verify = () => run(async () => {
    setResult(await fetch(`${API}/verify/${vid.trim()}`).then((r) => r.json()));
    setMsg("");
  });

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="app">
      <h1>Blockchain Degree Verification (DID)</h1>
      {!acct ? <button onClick={connect}>Connect MetaMask</button> : (
        <p className="bar"><b>{ROLES[role]}{isReg && " + Regulator"}</b> — {acct}</p>
      )}
      {msg && <p className="msg">{msg}</p>}

      {acct && role === 0 && (
        <section><h2>Create your DID</h2>
          <button onClick={() => register(2)}>Register as Student</button>{" "}
          <button onClick={() => register(3)}>Register as Employer</button></section>
      )}

      {isReg && (
        <section><h2>Regulator: accredit a university</h2>
          <input placeholder="University wallet 0x..." value={uni} onChange={(e) => setUni(e.target.value)} />
          <button onClick={accredit}>Accredit</button></section>
      )}

      {role === 1 && (<>
        <section><h2>University: sign & issue degree</h2>
          <input placeholder="Student wallet 0x..." value={f.studentAddress} onChange={set("studentAddress")} />
          <input placeholder="Student name" value={f.studentName} onChange={set("studentName")} />
          <input placeholder="Degree" value={f.degree} onChange={set("degree")} />
          <input placeholder="Branch" value={f.branch} onChange={set("branch")} />
          <input placeholder="Marks (e.g. DS:88, DBMS:91)" value={f.marks} onChange={set("marks")} />
          <input placeholder="CGPA" value={f.cgpa} onChange={set("cgpa")} />
          <input placeholder="Year" value={f.year} onChange={set("year")} />
          <button onClick={issue}>Sign & Issue</button></section>
        <section><h2>University: revoke degree</h2>
          <input placeholder="Credential ID" value={revId} onChange={(e) => setRevId(e.target.value)} />
          <button onClick={revoke}>Revoke</button></section>
      </>)}

      {role === 2 && (
        <section><h2>Student wallet</h2>
          <button onClick={loadWallet}>Load my degrees</button>
          {creds.map((d) => (
            <div className="card" key={d.id}>
              <b>{d.degree} — {d.branch}</b> ({d.year})<br />
              {d.studentName} | CGPA {d.cgpa} | Marks: {d.marks}<br />
              <small>Share this ID with employer: <code>{d.id}</code></small>
            </div>))}
        </section>
      )}

      {role === 3 && (
        <section><h2>Employer: request proof</h2>
          <input placeholder="Credential ID from student" value={vid} onChange={(e) => setVid(e.target.value)} />
          <button onClick={verify}>Verify</button>
          {result && (
            <div className={"card " + (result.valid ? "ok" : "bad")}>
              <b>{result.valid ? "✔ VERIFIED — Job / Admission approved" : "✘ REJECTED — Fake degree"}</b>
              <p>{result.reason}</p>
              {result.credential && <p>{result.credential.studentName}: {result.credential.degree} ({result.credential.branch}), CGPA {result.credential.cgpa}</p>}
            </div>)}
        </section>
      )}
    </div>
  );
}
