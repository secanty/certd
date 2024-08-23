import { createVerify } from "node:crypto";
import { logger } from "../utils/index.js";
import dayjs from "dayjs";

const SecreteKey =
  "LS0tLS1CRUdJTiBSU0EgUFVCTElDIEtFWS0tLS0tCk1JSUJDZ0tDQVFFQW9VWE1EWUhjdi82WFROWEZFSUI2RlpuR2FER0cwZnR5bTV1dVhPck9NaVl0UkxSb1lvSGMKNVZxenE0N00rdEFqRFBhaTBlOFhWS1c3aytUQUw3MUs0N2JCQVEyWTBxNU5Ya3lYcE5PTVdueVFMYXBwb0tWNgpPMkFJMnpFVURWMVJVa0ZtMFZTVjU0VXNzMDcrdjI2aW5aQU1CWitDMU42eWFDc2tZL3grNnVlNkVRNVcyZXdFCjZOWEhJcUU1bHdEUmU2SXJtdEpnU2doSnlHTS91azIyejN6NGEraFVPVUlWMy9DbEhYV0VhRHBBRFFsakt3NSsKeHR0dURiTHZyUmdzdWp6czB0dEI2OE1SbXE0R0FJL0JtNWVPWkhlNGxFQjBFVVhFUXdVWE1jV1N1VFZSMUE2cApUM21LRGo5MGcwVDFZUlNOdE5TMm9aRzgvRWIwOVlxK3Z3SURBUUFCCi0tLS0tRU5EIFJTQSBQVUJMSUMgS0VZLS0tLS0K";
export const appKey = "kQth6FHM71IPV3qdWc";
export type LicenseVerifyReq = {
  subjectId: string;
  license: string;
};

type License = {
  appKey: string;
  code: string;
  subjectId: string;
  expireTime: number;
  activeTime: number;
  duration: number;
  version: number;
  secret: string;
  level: number;
  signature: string;
};

class LicenseHolder {
  isPlus = false;
  expireTime = 0;
  level = 1;
  message?: string = undefined;
  secret?: string = undefined;
}
const holder = new LicenseHolder();
holder.isPlus = false;

class LicenseVerifier {
  checked = false;
  licenseReq?: LicenseVerifyReq = undefined;
  async reVerify(req: LicenseVerifyReq) {
    this.checked = false;
    return await this.verify(req);
  }

  setPlus(value: boolean, info: any = {}) {
    if (value && info) {
      holder.isPlus = true;
      holder.expireTime = info.expireTime;
      holder.secret = info.secret;
      holder.level = info.level;
    } else {
      holder.isPlus = false;
      holder.expireTime = 0;
      holder.level = 1;
      holder.message = info.message;
      holder.secret = undefined;
    }
    return {
      ...holder,
    };
  }
  async verify(req: LicenseVerifyReq) {
    this.licenseReq = req;
    if (this.checked) {
      return this.setPlus(false);
    }
    const license = req?.license;
    if (!license) {
      this.checked = true;
      return this.setPlus(false);
    }

    const licenseJson = Buffer.from(Buffer.from(license, "hex").toString(), "base64").toString();
    const json: License = JSON.parse(licenseJson);
    if (json.expireTime < Date.now()) {
      logger.warn("授权已过期");
      return this.setPlus(false, { message: "授权已过期" });
    }
    const content = `${appKey},${this.licenseReq.subjectId},${json.code},${json.secret},${json.level},${json.activeTime},${json.duration},${json.expireTime},${json.version}`;
    // content := fmt.Sprintf("%s,%s,%s,%s,%d,%d,%d,%d,%d", entity.AppKey, entity.SubjectId, entity.Code, entity.Secret, entity.Level, entity.ActiveTime, entity.Duration, entity.ExpireTime, entity.Version)
    //z4nXOeTeSnnpUpnmsV,_m9jFTdNHktdaEN4xBDw_,HZz7rAAR3h3zGlDMhScO1wGBYPjXpZ9S_1,uUpr9I8p6K3jWSzu2Wh5NECvgG2FNynU,0,1724199847470,365,1787271324416,1
    logger.debug("content:", content);
    const publicKey = Buffer.from(SecreteKey, "base64").toString();
    const res = this.verifySignature(content, json.signature, publicKey);
    this.checked = true;
    if (!res) {
      logger.warn("授权校验失败");
      return this.setPlus(false, { message: "授权校验失败" });
    }
    logger.info(`授权校验成功，到期时间：${dayjs(json.expireTime).format("YYYY-MM-DD HH:mm:ss")}`);
    return this.setPlus(true, {
      expireTime: json.expireTime,
      level: json.level || 1,
      secret: json.secret,
    });
  }

  verifySignature(content: string, signature: any, publicKey: string) {
    const verify = createVerify("RSA-SHA256");
    verify.update(content);
    return verify.verify(publicKey, signature, "base64");
  }
}

const verifier = new LicenseVerifier();

export function isPlus() {
  return holder.isPlus;
}

export function getPlusInfo() {
  return {
    isPlus: holder.isPlus,
    level: holder.level,
    expireTime: holder.expireTime,
    secret: holder.secret,
  };
}

export async function verify(req: LicenseVerifyReq) {
  return await verifier.reVerify(req);
}
