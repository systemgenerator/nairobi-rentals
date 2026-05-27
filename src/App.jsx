import { useState } from "react";

export default function App() {
  const [phone, setPhone] = useState("");

  const handlePay = async () => {
    try {
      const res = await fetch(
        "https://nairobi-rentals.onrender.com/stkpush",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: phone,
          }),
        }
      );

      const data = await res.json();
      alert("STK Push sent: " + JSON.stringify(data));
    } catch (error) {
      alert("Payment failed");
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Nairobi Rentals</h1>

      <p>Enter phone number to test MPESA payment</p>

      <input
        type="text"
        placeholder="e.g. 254712345678"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        style={{ padding: "10px", width: "250px" }}
      />

      <br /><br />

      <button
        onClick={handlePay}
        style={{
          padding: "10px 20px",
          background: "green",
          color: "white",
          border: "none",
          cursor: "pointer",
        }}
      >
        Pay with MPESA
      </button>
    </div>
  );
}