import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [selectedListing, setSelectedListing] = useState<any>(null);

  const [search, setSearch] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const [favorites, setFavorites] = useState<string[]>([]);

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState("");
  const [phone, setPhone] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);

  // ================= LOAD USER =================
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    fetchListings();
  }, []);

  // ================= FETCH LISTINGS =================
  const fetchListings = async () => {
    const { data } = await supabase
      .from("listings")
      .select("*")
      .order("featured", { ascending: false });

    setListings(data || []);
  };

  // ================= LOGIN =================
  const login = async () => {
    const email = prompt("Enter email");
    if (!email) return;

    await supabase.auth.signInWithOtp({ email });
    alert("Check email for login link");
  };

  // ================= LOGOUT =================
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // ================= CREATE LISTING =================
  const createListing = async () => {
    if (!title || !location || !price || !phone || !imageFile) {
      alert("Fill all fields");
      return;
    }

    setLoading(true);

    const fileName = `${Date.now()}-${imageFile.name}`;

    const { error } = await supabase.storage
      .from("listing-images")
      .upload(fileName, imageFile);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const { data } = supabase.storage
      .from("listing-images")
      .getPublicUrl(fileName);

    await supabase.from("listings").insert([
      {
        title,
        location,
        price: Number(price),
        phone: phone,
        image: data.publicUrl,
        featured: false,
      },
    ]);

    setTitle("");
    setLocation("");
    setPrice("");
    setPhone("");
    setImageFile(null);

    fetchListings();
    setLoading(false);
  };

  // ================= FEATURE LISTING (MPESA) =================
  const featureListing = async (id: string) => {
    const mpesa = prompt("Enter MPESA number");
    if (!mpesa) return;

    const res = await fetch("https://nairobi-rentals.onrender.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: mpesa }),
    });

    const data = await res.json();

    if (data.ResponseCode === "0") {
      await supabase
        .from("listings")
        .update({ featured: true })
        .eq("id", id);

      fetchListings();
      alert("Payment successful — Listing featured!");
    } else {
      alert("Payment failed");
    }
  };

  // ================= FAVORITES =================
  const toggleFavorite = (id: string) => {
    if (favorites.includes(id)) {
      setFavorites(favorites.filter((f) => f !== id));
    } else {
      setFavorites([...favorites, id]);
    }
  };

  // ================= WHATSAPP (DYNAMIC) =================
  const openWhatsApp = (item: any) => {
    if (!item.phone) {
      alert("No phone number for this listing");
      return;
    }

    const message = `Hello, I am interested in your house: ${item.title} at KSh ${item.price} in ${item.location}`;

    const url = `https://wa.me/${item.phone}?text=${encodeURIComponent(
      message
    )}`;

    window.open(url, "_blank");
  };

  // ================= FILTERS =================
  const filtered = listings.filter((item) => {
    const matchSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.location.toLowerCase().includes(search.toLowerCase());

    const matchPrice =
      maxPrice === "" || item.price <= Number(maxPrice);

    return matchSearch && matchPrice;
  });

  // ================= DETAILS PAGE =================
  if (selectedListing) {
    return (
      <div className="container">
        <button onClick={() => setSelectedListing(null)}>
          ← Back
        </button>

        {selectedListing.featured && (
          <div className="card" style={{ background: "gold" }}>
            ⭐ FEATURED PROPERTY
          </div>
        )}

        <img src={selectedListing.image} />

        <h1>{selectedListing.title}</h1>
        <h2>KSh {selectedListing.price}</h2>
        <p>📍 {selectedListing.location}</p>

        <button
          className="btn-primary"
          onClick={() => openWhatsApp(selectedListing)}
        >
          💬 WhatsApp Chat
        </button>

        <button
          className="btn-save"
          onClick={() => toggleFavorite(selectedListing.id)}
        >
          {favorites.includes(selectedListing.id)
            ? "❤️ Saved"
            : "🤍 Save"}
        </button>

        {!selectedListing.featured && (
          <button
            className="btn-feature"
            onClick={() => featureListing(selectedListing.id)}
          >
            💳 Feature Listing
          </button>
        )}
      </div>
    );
  }

  // ================= HOME PAGE =================
  return (
    <div className="container">
      <div className="header">🏠 Nairobi Rental Marketplace</div>

      {!user ? (
        <button className="btn-primary" onClick={login}>
          Login
        </button>
      ) : (
        <>
          <p>✅ {user.email}</p>
          <button onClick={logout}>Logout</button>

          {/* CREATE LISTING */}
          <div className="card">
            <h3>Create Listing</h3>

            <input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <input
              placeholder="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />

            <input
              placeholder="Price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />

            <input
              placeholder="Phone (2547XXXXXXXX)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <input
              type="file"
              onChange={(e) =>
                setImageFile(e.target.files?.[0] || null)
              }
            />

            <button
              className="btn-primary"
              onClick={createListing}
              disabled={loading}
            >
              {loading ? "Uploading..." : "Create Listing"}
            </button>
          </div>

          {/* SEARCH */}
          <div className="card">
            <input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <input
              placeholder="Max Price"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>

          {/* LISTINGS */}
          {filtered.map((item) => (
            <div className="card" key={item.id}>
              {item.featured && (
                <div style={{ background: "gold", padding: 5 }}>
                  ⭐ FEATURED
                </div>
              )}

              <img
                src={item.image}
                onClick={() => setSelectedListing(item)}
              />

              <h3>{item.title}</h3>
              <p>{item.location}</p>
              <p>KSh {item.price}</p>

              <button
                className="btn-primary"
                onClick={() => openWhatsApp(item)}
              >
                💬 WhatsApp
              </button>

              <button
                className="btn-save"
                onClick={() => toggleFavorite(item.id)}
              >
                {favorites.includes(item.id)
                  ? "❤️ Saved"
                  : "🤍 Save"}
              </button>

              {!item.featured && (
                <button
                  className="btn-feature"
                  onClick={() => featureListing(item.id)}
                >
                  Feature
                </button>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}