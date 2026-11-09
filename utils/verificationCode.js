import { randomInt } from "crypto";

const generateVerificationCode = () => {
  return randomInt(100000, 1000000).toString();
};

export default generateVerificationCode;