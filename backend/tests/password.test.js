
const {
  hashPassword,
  comparePassword,
} = require("../src/utils/password");

async function runTest() {
  const password = "TestPassword123!";

  const passwordHash = await hashPassword(password);

  console.log("Hash created:", passwordHash !== password);
  console.log(
    "Correct password accepted:",
    await comparePassword(password, passwordHash)
  );
  console.log(
    "Incorrect password rejected:",
    !(await comparePassword("WrongPassword!", passwordHash))
  );
}

runTest().catch((error) => {
  console.error("Password test failed:", error.message);
  process.exitCode = 1;
});