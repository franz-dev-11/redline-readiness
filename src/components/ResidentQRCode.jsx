import { QRCodeSVG } from "qrcode.react";
import React from "react";

const ResidentQRCode = ({ residentId }) => {
  if (!residentId) return null;
  const qrValue = `resident:${residentId}`;
  return (
    <div style={{ textAlign: "center", margin: "1rem 0" }}>
      <QRCodeSVG value={qrValue} size={180} />
      <div style={{ marginTop: 8, fontSize: 14 }}>
        Resident QR: {residentId}
      </div>
    </div>
  );
};

export default ResidentQRCode;
