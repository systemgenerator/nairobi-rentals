import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// ================= ENV =================
const {
  CONSUMER_KEY,
  CONSUMER_SECRET,
  SHORTCODE,
  PASSKEY,
  CALLBACK_URL
} = process.env;

// ================= ACCESS TOKEN =================
async function getAccessToken() {
  try {
    const auth = Buffer.from(
      `${CONSUMER_KEY}:${CONSUMER_SECRET}`
    ).toString("base64");

    const response = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.log("Token Error:", error.response?.data || error.message);
  }
}

// ================= STK PUSH =================
app.post("/stkpush", async (req, res) => {
  try {
    const { phone } = req.body;

    const token = await getAccessToken();

    const timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, "")
      .slice(0, -3);

    const password = Buffer.from(
      `${SHORTCODE}${PASSKEY}${timestamp}`
    ).toString("base64");

    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        BusinessShortCode: SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: 1,
        PartyA: phone,
        PartyB: SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: CALLBACK_URL,
        AccountReference: "Nairobi Rentals",
        TransactionDesc: "Listing Payment"
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    res.json(response.data);

  } catch (error) {
    console.log("STK Error:", error.response?.data || error.message);
    res.status(500).json({
      error: "STK Push failed"
    });
  }
});

// ================= IMPROVED CALLBACK =================
app.post("/callback", (req, res) => {
  try {
    console.log("📩 MPESA CALLBACK RECEIVED:");
    console.log(JSON.stringify(req.body, null, 2));

    const callback = req.body?.Body?.stkCallback;

    if (!callback) {
      console.log("❌ Invalid callback structure");
      return res.json({ ResultCode: 0, ResultDesc: "Ignored" });
    }

    const resultCode = callback.ResultCode;
    const resultDesc = callback.ResultDesc;

    // ================= SUCCESS =================
    if (resultCode === 0) {
      const items = callback.CallbackMetadata?.Item || [];

      let amount = null;
      let receipt = null;
      let phone = null;
      let date = null;

      items.forEach(item => {
        if (item.Name === "Amount") amount = item.Value;
        if (item.Name === "MpesaReceiptNumber") receipt = item.Value;
        if (item.Name === "PhoneNumber") phone = item.Value;
        if (item.Name === "TransactionDate") date = item.Value;
      });

      console.log("✅ PAYMENT SUCCESS");
      console.log("Amount:", amount);
      console.log("Receipt:", receipt);
      console.log("Phone:", phone);
      console.log("Date:", date);

      // 👉 FUTURE: SAVE TO DATABASE HERE
      // Example:
      // savePayment({ amount, receipt, phone, date, status: "SUCCESS" });

    } else {
      console.log("❌ PAYMENT FAILED");
      console.log("Reason:", resultDesc);
    }

    // ALWAYS ACKNOWLEDGE SAFARICOM
    return res.json({
      ResultCode: 0,
      ResultDesc: "Accepted"
    });

  } catch (error) {
    console.error("❌ CALLBACK ERROR:", error);

    return res.json({
      ResultCode: 0,
      ResultDesc: "Error handled"
    });
  }
});

// ================= START SERVER =================
app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});