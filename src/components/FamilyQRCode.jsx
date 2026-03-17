import { QRCodeSVG } from "qrcode.react";
import React from "react";

const FamilyQRCode = ({ familyId }) => {
  if (!familyId) return null;
  const qrValue = `family:${familyId}`;
  return (
    <div style={{ textAlign: "center", margin: "1rem 0" }}>
      <QRCodeSVG value={qrValue} size={180} />
      <div style={{ marginTop: 8, fontSize: 14 }}>Family QR: {familyId}</div>
    </div>
  );
};

export default FamilyQRCode;
