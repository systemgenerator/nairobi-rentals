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

// ================= CALLBACK =================
app.post("/callback", (req, res) => {
  console.log("MPESA CALLBACK:", req.body);

  res.json({
    ResultCode: 0,
    ResultDesc: "Accepted"
  });
});

// ================= START SERVER =================
app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});