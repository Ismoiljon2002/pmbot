const df = require('digest-fetch');
const DigestFetch = df.default || df.DigestFetch || df;
const FormData = require('form-data');

class HikvisionClient {
  constructor(ip, port, user, pass) {
    this.ip = ip;
    this.port = port;
    this.baseUrl = `http://${ip}:${port}/ISAPI`;
    this.client = new DigestFetch(user, pass);
  }

  async rawFetch(path, options = {}) {
    try {
      const response = await this.client.fetch(this.baseUrl + path, options);
      return response;
    } catch (err) {
      console.error(`Hikvision Error [${this.ip}]: ${err.message}`);
      throw err;
    }
  }

  async addUser(employeeNo, name) {
    const payload = {
      UserInfo: {
        employeeNo: employeeNo.toString(),
        name: name.toString(),
        userType: 'normal',
        Valid: {
          enable: true,
          beginTime: '2000-01-01T00:00:00',
          endTime: '2037-12-31T23:59:59',
          timeType: 'local',
        },
        doorRight: '1',
        RightPlan: [
          {
            doorNo: 1,
            planTemplateNo: '1',
          },
        ],
      },
    };

    const res = await this.rawFetch('/AccessControl/UserInfo/Record?format=json', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Failed to add user ${employeeNo} to ${this.ip}. HTTP ${res.status}: ${text}`
      );
    }
    return res.json();
  }

  async addFace(employeeNo, imageBuffer) {
    const form = new FormData();

    const faceDataRecord = {
      faceLibType: 'blackFD',
      FDID: '1',
      FPID: employeeNo.toString(),
    };

    form.append('FaceDataRecord', JSON.stringify(faceDataRecord), {
      contentType: 'application/json',
    });

    form.append('FaceImage', imageBuffer, {
      filename: `${employeeNo}.jpg`,
      contentType: 'image/jpeg',
    });

    const bodyBuffer = form.getBuffer();

    const res = await this.rawFetch('/Intelligent/FDLib/FaceDataRecord?format=json', {
      method: 'POST',
      body: bodyBuffer,
      headers: form.getHeaders(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Failed to add face for ${employeeNo} to ${this.ip}. HTTP ${res.status}: ${text}`
      );
    }
    return res.json();
  }

  async deleteUser(employeeNo) {
    const payload = {
      UserInfoDetail: {
        mode: 'byEmployeeNo',
        EmployeeNoList: [{ employeeNo: employeeNo.toString() }],
      },
    };
    const res = await this.rawFetch('/AccessControl/UserInfo/Delete?format=json', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      throw new Error(
        `Failed to delete user ${employeeNo} on ${this.ip}. HTTP ${res.status}: ${text}`
      );
    }
    return res.ok ? res.json() : null;
  }
}

let enterCamera = null;
let exitCamera = null;

const getCameras = () => {
  if (!enterCamera && process.env.HIKVISION_ENTER_IP) {
    enterCamera = new HikvisionClient(
      process.env.HIKVISION_ENTER_IP,
      process.env.HIKVISION_ENTER_PORT,
      process.env.HIKVISION_USER,
      process.env.HIKVISION_PASS
    );
  }
  if (!exitCamera && process.env.HIKVISION_EXIT_IP) {
    exitCamera = new HikvisionClient(
      process.env.HIKVISION_EXIT_IP,
      process.env.HIKVISION_EXIT_PORT,
      process.env.HIKVISION_USER,
      process.env.HIKVISION_PASS
    );
  }
  return { enterCamera, exitCamera };
};

module.exports = { HikvisionClient, getCameras };
