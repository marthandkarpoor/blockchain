const hre = require("hardhat");
const fs = require("fs");

async function main() {
  // Ganache accounts: 0 = regulator, 1 = university, 2 = student, 3 = employer (demo setup)
  const [reg, uni, stu, emp] = await hre.ethers.getSigners();
  const F = await hre.ethers.getContractFactory("DegreeRegistry");
  const c = await F.deploy();
  await c.waitForDeployment();
  const address = await c.getAddress();

  await (await c.accreditUniversity(uni.address, "did:ethr:" + uni.address)).wait();
  await (await c.connect(stu).registerSelf(2, "did:ethr:" + stu.address)).wait();
  await (await c.connect(emp).registerSelf(3, "did:ethr:" + emp.address)).wait();

  const abi = JSON.parse(c.interface.formatJson());
  for (const dir of ["backend", "frontend/src"])
    fs.writeFileSync(`${dir}/contract.json`, JSON.stringify({ address, abi }, null, 2));

  console.log("Contract:", address);
  console.log("Regulator :", reg.address);
  console.log("University:", uni.address);
  console.log("Student   :", stu.address);
  console.log("Employer  :", emp.address);
}
main().catch((e) => { console.error(e); process.exit(1); });
