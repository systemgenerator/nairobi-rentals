import { useEffect, useState } from "react";
import "./App.css";
import { supabase } from "./supabaseClient";
import Auth from "./Auth";

const STORAGE_BUCKET = "property-images";

export default function App() {
  const [view, setView] = useState("home");
  const [user, setUser] = useState(null);

  const [properties, setProperties] = useState([]);
  const [pendingProperties, setPendingProperties] = useState([]);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // ================= SEARCH =================

  const [search, setSearch] = useState("");
  const [propertyTypeFilter, setPropertyTypeFilter] =
    useState("All");
  const [minRent, setMinRent] = useState("");
  const [maxRent, setMaxRent] = useState("");

  // ================= FORM =================

  const [form, setForm] = useState({
    title: "",
    property_type: "Apartment",
    location: "",
    rent: "",
    description: "",
    landlord_name: "",
    whatsapp: "",
  });

  const [selectedImages, setSelectedImages] = useState([]);

  // ================= LOAD APPROVED =================

  const loadProperties = async () => {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("status", "approved")
      .order("is_premium", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Error loading properties:",
        error
      );
      return;
    }

    setProperties(data || []);
  };

  // ================= LOAD PENDING =================

  const loadPendingProperties = async () => {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("status", "pending")
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Admin loading error:",
        error
      );
      return;
    }

    setPendingProperties(data || []);
  };

  // ================= AUTHENTICATION =================

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ================= INITIAL LOAD =================

  useEffect(() => {
    loadProperties();
  }, []);

  // ================= AUTH HANDLERS =================

  const handleAuthLogin = (loggedInUser) => {
    setUser(loggedInUser);

    if (loggedInUser) {
      const fullName =
        loggedInUser.user_metadata?.full_name || "";

      setForm((previousForm) => ({
        ...previousForm,
        landlord_name:
          previousForm.landlord_name || fullName,
      }));

      setView("submit");
    } else {
      setView("home");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setView("home");
  };

  // ================= FORM CHANGE =================

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // ================= IMAGE SELECTION =================

  const handleImageChange = (e) => {
    const files = Array.from(
      e.target.files || []
    );

    if (files.length > 5) {
      alert(
        "Please select a maximum of 5 photos."
      );
      return;
    }

    const validFiles = files.filter((file) => {
      if (!file.type.startsWith("image/")) {
        return false;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert(
          `${file.name} is larger than 5MB.`
        );
        return false;
      }

      return true;
    });

    setSelectedImages(validFiles);
  };

  // ================= UPLOAD IMAGES =================

  const uploadImages = async () => {
    const imageUrls = [];

    for (const file of selectedImages) {
      const extension =
        file.name.split(".").pop() || "jpg";

      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${extension}`;

      const filePath =
        `properties/${fileName}`;

      const { error: uploadError } =
        await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(
            filePath,
            file,
            {
              cacheControl: "3600",
              upsert: false,
            }
          );

      if (uploadError) {
        throw new Error(
          `Could not upload ${file.name}: ${uploadError.message}`
        );
      }

      const { data } =
        supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(
            filePath
          );

      if (data?.publicUrl) {
        imageUrls.push(
          data.publicUrl
        );
      }
    }

    return imageUrls;
  };

  // ================= SUBMIT PROPERTY =================

  const submitProperty = async (e) => {
    e.preventDefault();

    if (
      !form.title ||
      !form.location ||
      !form.rent ||
      !form.landlord_name ||
      !form.whatsapp
    ) {
      alert(
        "Please fill in all required fields."
      );
      return;
    }

    if (selectedImages.length === 0) {
      alert(
        "Please upload at least one property photo."
      );
      return;
    }

    setLoading(true);

    try {
      setUploading(true);

      const imageUrls =
        await uploadImages();

      setUploading(false);

      const { error } =
        await supabase
          .from("properties")
          .insert([
            {
              title: form.title,
              property_type:
                form.property_type,
              location:
                form.location,
              rent: Number(
                form.rent
              ),
              description:
                form.description,
              landlord_name:
                form.landlord_name,
              whatsapp:
                form.whatsapp,
              status: "pending",
              is_premium: false,
              image_urls:
                imageUrls,
            },
          ]);

      if (error) {
        alert(
          "Could not submit property:\n\n" +
            error.message
        );
        return;
      }

      alert(
        "Property submitted successfully!\n\nYour property will be reviewed before appearing publicly."
      );

      setForm({
        title: "",
        property_type:
          "Apartment",
        location: "",
        rent: "",
        description: "",
        landlord_name: "",
        whatsapp: "",
      });

      setSelectedImages([]);

      const fileInput =
        document.getElementById(
          "property-images"
        );

      if (fileInput) {
        fileInput.value = "";
      }

      setView("home");
    } catch (error) {
      console.error(error);

      alert(
        error.message ||
          "Something went wrong."
      );
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  // ================= APPROVE =================

  const approveProperty = async (id) => {
    const confirmed =
      window.confirm(
        "Approve this property and make it public?"
      );

    if (!confirmed) return;

    const { error } =
      await supabase
        .from("properties")
        .update({
          status: "approved",
          is_premium: false,
        })
        .eq("id", id);

    if (error) {
      alert(
        "Could not approve property:\n\n" +
          error.message
      );
      return;
    }

    alert(
      "Property approved!"
    );

    await loadPendingProperties();
    await loadProperties();
  };

  // ================= REJECT =================

  const rejectProperty = async (id) => {
    const confirmed =
      window.confirm(
        "Reject this property?"
      );

    if (!confirmed) return;

    const { error } =
      await supabase
        .from("properties")
        .update({
          status: "rejected",
          is_premium: false,
        })
        .eq("id", id);

    if (error) {
      alert(
        "Could not reject property:\n\n" +
          error.message
      );
      return;
    }

    alert(
      "Property rejected."
    );

    await loadPendingProperties();
  };

  // ================= MAKE PREMIUM =================

  const makePremium = async (id) => {
    const confirmed =
      window.confirm(
        "Make this property a PREMIUM listing?"
      );

    if (!confirmed) return;

    const { error } =
      await supabase
        .from("properties")
        .update({
          is_premium: true,
        })
        .eq("id", id)
        .eq("status", "approved");

    if (error) {
      alert(
        "Could not make property premium:\n\n" +
          error.message
      );
      return;
    }

    alert(
      "⭐ Property is now PREMIUM!"
    );

    await loadProperties();
  };

  // ================= REMOVE PREMIUM =================

  const removePremium = async (id) => {
    const confirmed =
      window.confirm(
        "Remove Premium status from this property?"
      );

    if (!confirmed) return;

    const { error } =
      await supabase
        .from("properties")
        .update({
          is_premium: false,
        })
        .eq("id", id);

    if (error) {
      alert(
        "Could not remove Premium status:\n\n" +
          error.message
      );
      return;
    }

    alert(
      "Premium status removed."
    );

    await loadProperties();
  };

  // ================= WHATSAPP =================

  const contactWhatsApp = (
    property
  ) => {
    let phone =
      property.whatsapp.replace(
        /\D/g,
        ""
      );

    if (
      phone.startsWith("07") ||
      phone.startsWith("01")
    ) {
      phone =
        "254" +
        phone.substring(1);
    }

    const message =
      encodeURIComponent(
        `Hello, I found your property "${property.title}" on Nairobi Rentals. I am interested in it.`
      );

    window.open(
      `https://wa.me/${phone}?text=${message}`,
      "_blank"
    );
  };

  // ================= FILTER =================

  const filteredProperties =
    properties.filter(
      (property) => {
        const searchText =
          search
            .toLowerCase()
            .trim();

        const matchesSearch =
          !searchText ||
          property.title
            ?.toLowerCase()
            .includes(searchText) ||
          property.location
            ?.toLowerCase()
            .includes(searchText) ||
          property.description
            ?.toLowerCase()
            .includes(searchText);

        const matchesType =
          propertyTypeFilter ===
            "All" ||
          property.property_type ===
            propertyTypeFilter;

        const rent =
          Number(property.rent);

        const matchesMin =
          !minRent ||
          rent >=
            Number(minRent);

        const matchesMax =
          !maxRent ||
          rent <=
            Number(maxRent);

        return (
          matchesSearch &&
          matchesType &&
          matchesMin &&
          matchesMax
        );
      }
    );

  // ================= CLEAR FILTERS =================

  const clearFilters = () => {
    setSearch("");
    setPropertyTypeFilter(
      "All"
    );
    setMinRent("");
    setMaxRent("");
  };

  // ================= AUTH =================

  if (view === "auth") {
    return <Auth onLogin={handleAuthLogin} />;
  }

  // ================= ADMIN =================

  if (view === "admin") {
    return (
      <div className="app">

        <header className="navbar">

          <div
            className="logo"
            onClick={() =>
              setView("home")
            }
          >
            Nairobi
            <span>
              Rentals
            </span>
          </div>

          <nav>

            <button
              onClick={() =>
                setView("home")
              }
            >
              Public Website
            </button>

          </nav>

        </header>

        <main className="admin-section">

          <div className="admin-header">

            <div>

              <p className="section-small">
                ADMIN
              </p>

              <h1>
                Verification Dashboard
              </h1>

              <p>
                Review properties
                submitted by
                landlords.
              </p>

            </div>

            <button
              className="primary-button"
              onClick={
                async () => {
                  await loadPendingProperties();
                  await loadProperties();
                }
              }
            >
              Refresh
            </button>

          </div>

          <div className="admin-stats">

            <div className="admin-stat">

              <strong>
                {
                  pendingProperties.length
                }
              </strong>

              <span>
                Pending
              </span>

            </div>

            <div className="admin-stat">

              <strong>
                {
                  properties.length
                }
              </strong>

              <span>
                Approved
              </span>

            </div>

            <div className="admin-stat">

              <strong>
                {
                  properties.filter(
                    (p) =>
                      p.is_premium
                  ).length
                }
              </strong>

              <span>
                Premium
              </span>

            </div>

          </div>

          {/* ================= PENDING ================= */}

          <h2 className="admin-subtitle">
            Pending Properties
          </h2>

          {
            pendingProperties.length ===
            0 ? (

              <div className="empty-state">

                <h3>
                  No pending
                  properties
                </h3>

                <p>
                  New landlord
                  submissions will
                  appear here.
                </p>

              </div>

            ) : (

              <div className="admin-list">

                {
                  pendingProperties.map(
                    (property) => (

                      <div
                        className="admin-property"
                        key={
                          property.id
                        }
                      >

                        {
                          property
                            .image_urls
                            ?.length >
                            0 && (

                            <div className="admin-images">

                              {
                                property.image_urls.map(
                                  (
                                    image,
                                    index
                                  ) => (

                                    <img
                                      key={
                                        index
                                      }
                                      src={
                                        image
                                      }
                                      alt={`Property ${
                                        index +
                                        1
                                      }`}
                                    />

                                  )
                                )
                              }

                            </div>

                          )
                        }

                        <div className="admin-property-info">

                          <div className="admin-property-icon">
                            🏠
                          </div>

                          <div>

                            <p className="property-type">
                              {
                                property.property_type
                              }
                            </p>

                            <h2>
                              {
                                property.title
                              }
                            </h2>

                            <p>
                              📍{" "}
                              {
                                property.location
                              }
                            </p>

                            <p>
                              💰 KSh{" "}
                              {Number(
                                property.rent
                              ).toLocaleString()}
                              /month
                            </p>

                            <p>
                              👤{" "}
                              {
                                property.landlord_name
                              }
                            </p>

                            <p>
                              📱{" "}
                              {
                                property.whatsapp
                              }
                            </p>

                            {
                              property.description && (
                                <p>
                                  {
                                    property.description
                                  }
                                </p>
                              )
                            }

                          </div>

                        </div>

                        <div className="admin-actions">

                          <button
                            className="approve-button"
                            onClick={() =>
                              approveProperty(
                                property.id
                              )
                            }
                          >
                            ✓ Approve
                          </button>

                          <button
                            className="reject-button"
                            onClick={() =>
                              rejectProperty(
                                property.id
                              )
                            }
                          >
                            ✕ Reject
                          </button>

                        </div>

                      </div>

                    )
                  )
                }

              </div>

            )
          }

          {/* ================= APPROVED ================= */}

          <h2 className="admin-subtitle">
            Approved Properties
          </h2>

          {
            properties.length ===
            0 ? (

              <div className="empty-state">

                <p>
                  No approved
                  properties yet.
                </p>

              </div>

            ) : (

              <div className="admin-list">

                {
                  properties.map(
                    (property) => (

                      <div
                        className="admin-property"
                        key={
                          property.id
                        }
                      >

                        {
                          property
                            .image_urls
                            ?.length >
                            0 && (

                            <div className="admin-images">

                              {
                                property.image_urls.map(
                                  (
                                    image,
                                    index
                                  ) => (

                                    <img
                                      key={
                                        index
                                      }
                                      src={
                                        image
                                      }
                                      alt={`Property ${
                                        index +
                                        1
                                      }`}
                                    />

                                  )
                                )
                              }

                            </div>

                          )
                        }

                        <div className="admin-property-info">

                          <div className="admin-property-icon">
                            🏠
                          </div>

                          <div>

                            {
                              property.is_premium && (
                                <div className="premium-admin-label">
                                  ⭐ PREMIUM
                                </div>
                              )
                            }

                            <p className="property-type">
                              {
                                property.property_type
                              }
                            </p>

                            <h2>
                              {
                                property.title
                              }
                            </h2>

                            <p>
                              📍{" "}
                              {
                                property.location
                              }
                            </p>

                            <p>
                              💰 KSh{" "}
                              {Number(
                                property.rent
                              ).toLocaleString()}
                              /month
                            </p>

                            <p>
                              👤{" "}
                              {
                                property.landlord_name
                              }
                            </p>

                          </div>

                        </div>

                        <div className="admin-actions">

                          {
                            property.is_premium ? (

                              <button
                                className="remove-premium-button"
                                onClick={() =>
                                  removePremium(
                                    property.id
                                  )
                                }
                              >
                                Remove Premium
                              </button>

                            ) : (

                              <button
                                className="premium-button"
                                onClick={() =>
                                  makePremium(
                                    property.id
                                  )
                                }
                              >
                                ⭐ Make Premium
                              </button>

                            )
                          }

                        </div>

                      </div>

                    )
                  )
                }

              </div>

            )
          }

        </main>

      </div>
    );
  }

  // ================= MAIN WEBSITE =================

  return (
    <div className="app">

      {/* ================= NAVBAR ================= */}

      <header className="navbar">

        <div
          className="logo"
          onClick={() =>
            setView("home")
          }
        >
          Nairobi
          <span>
            Rentals
          </span>
        </div>

        <nav>

          <button
            onClick={() =>
              setView("home")
            }
          >
            Find a Home
          </button>

          <button
            className="landlord-button"
            onClick={() =>
              user ? setView("submit") : setView("auth")
            }
          >
            List Your Property
          </button>

          {user ? (
            <button
              className="admin-nav-button"
              onClick={handleLogout}
            >
              Logout
            </button>
          ) : null}

          <button
            className="admin-nav-button"
            onClick={async () => {
              await loadPendingProperties();
              await loadProperties();
              setView("admin");
            }}
          >
            Admin
          </button>

        </nav>

      </header>

      {/* ================= HOME ================= */}

      {view === "home" && (
        <>

          <section className="hero-section">

            <div className="hero-content">

              <p className="hero-small">
                FIND YOUR NEXT HOME
              </p>

              <h1>
                Find a place
                <br />
                <span>
                  you'll love.
                </span>
              </h1>

              <p className="hero-description">
                Discover verified
                rental properties
                from landlords
                across Nairobi.
              </p>

              <button
                className="primary-button"
                onClick={() =>
                  document
                    .getElementById(
                      "properties"
                    )
                    ?.scrollIntoView({
                      behavior:
                        "smooth",
                    })
                }
              >
                Browse Properties
              </button>

            </div>

          </section>

          {/* ================= PROPERTIES ================= */}

          <section
            id="properties"
            className="properties-section"
          >

            <div className="section-heading">

              <div>

                <p className="section-small">
                  AVAILABLE NOW
                </p>

                <h2>
                  Featured Rentals
                </h2>

              </div>

              <span>
                {
                  filteredProperties.length
                }{" "}
                properties
              </span>

            </div>

            {/* SEARCH */}

            <div className="search-panel">

              <div className="search-main">

                <input
                  type="text"
                  placeholder="Search by location or property..."
                  value={
                    search
                  }
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                />

              </div>

              <div className="search-filters">

                <select
                  value={
                    propertyTypeFilter
                  }
                  onChange={(e) =>
                    setPropertyTypeFilter(
                      e.target.value
                    )
                  }
                >

                  <option value="All">
                    All property
                    types
                  </option>

                  <option value="Apartment">
                    Apartment
                  </option>

                  <option value="Bedsitter">
                    Bedsitter
                  </option>

                  <option value="Studio">
                    Studio
                  </option>

                  <option value="1 Bedroom">
                    1 Bedroom
                  </option>

                  <option value="2 Bedroom">
                    2 Bedroom
                  </option>

                  <option value="3 Bedroom">
                    3 Bedroom
                  </option>

                  <option value="House">
                    House
                  </option>

                  <option value="Maisonette">
                    Maisonette
                  </option>

                </select>

                <input
                  type="number"
                  placeholder="Min rent"
                  value={
                    minRent
                  }
                  onChange={(e) =>
                    setMinRent(
                      e.target.value
                    )
                  }
                />

                <input
                  type="number"
                  placeholder="Max rent"
                  value={
                    maxRent
                  }
                  onChange={(e) =>
                    setMaxRent(
                      e.target.value
                    )
                  }
                />

                <button
                  type="button"
                  className="clear-filter"
                  onClick={
                    clearFilters
                  }
                >
                  Clear
                </button>

              </div>

            </div>

            {/* RESULTS */}

            {
              filteredProperties.length ===
              0 ? (

                <div className="empty-state">

                  <h3>
                    No properties
                    found
                  </h3>

                  <p>
                    Try changing
                    your search or
                    filters.
                  </p>

                  <button
                    className="primary-button"
                    onClick={
                      clearFilters
                    }
                  >
                    Clear Filters
                  </button>

                </div>

              ) : (

                <div className="property-grid">

                  {
                    filteredProperties.map(
                      (
                        property
                      ) => (

                        <div
                          className={`property-card ${
                            property.is_premium
                              ? "premium-card"
                              : ""
                          }`}
                          key={
                            property.id
                          }
                        >

                          {
                            property.is_premium && (
                              <div className="premium-badge">
                                ⭐ PREMIUM
                              </div>
                            )
                          }

                          <div className="property-image">

                            {
                              property
                                .image_urls
                                ?.length >
                              0 ? (

                                <img
                                  src={
                                    property
                                      .image_urls[0]
                                  }
                                  alt={
                                    property.title
                                  }
                                />

                              ) : property.image_url ? (

                                <img
                                  src={
                                    property.image_url
                                  }
                                  alt={
                                    property.title
                                  }
                                />

                              ) : (

                                <div className="image-placeholder">
                                  🏠
                                </div>

                              )
                            }

                          </div>

                          <div className="property-content">

                            <div className="property-type">
                              {
                                property.property_type
                              }
                            </div>

                            <h3>
                              {
                                property.title
                              }
                            </h3>

                            <p className="location">
                              📍{" "}
                              {
                                property.location
                              }
                            </p>

                            <p className="description">
                              {
                                property.description ||
                                "Contact the landlord for more information."
                              }
                            </p>

                            <div className="property-bottom">

                              <strong>
                                KSh{" "}
                                {Number(
                                  property.rent
                                ).toLocaleString()}

                                <small>
                                  /month
                                </small>
                              </strong>

                              <button
                                className="whatsapp-button"
                                onClick={() =>
                                  contactWhatsApp(
                                    property
                                  )
                                }
                              >
                                WhatsApp
                              </button>

                            </div>

                            <div className="verified">
                              ✓ Verified
                              listing
                            </div>

                          </div>

                        </div>

                      )
                    )
                  }

                </div>

              )
            }

          </section>

          {/* ================= LANDLORD CTA ================= */}

          <section className="landlord-banner">

            <div>

              <p className="section-small">
                FOR LANDLORDS
              </p>

              <h2>
                Have a property
                to rent?
              </h2>

              <p>
                List your property
                and reach tenants
                looking for homes
                in Nairobi.
              </p>

            </div>

            <button
              className="primary-button light-button"
              onClick={() =>
                user ? setView("submit") : setView("auth")
              }
            >
              Submit Property
            </button>

          </section>

        </>
      )}

      {/* ================= SUBMIT ================= */}

      {view === "submit" && (

        <section className="form-section">

          <div className="form-container">

            <button
              className="back-button"
              onClick={() =>
                setView("home")
              }
            >
              ← Back
            </button>

            <p className="section-small">
              LANDLORDS
            </p>

            <h1>
              List your property
            </h1>

            <p className="form-intro">
              Submit your property
              for verification.
              Approved properties
              will appear publicly.
            </p>

            <form
              onSubmit={
                submitProperty
              }
            >

              <label>
                Property title *

                <input
                  name="title"
                  value={
                    form.title
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="e.g. Modern 2 Bedroom Apartment"
                />
              </label>

              <label>
                Property type *

                <select
                  name="property_type"
                  value={
                    form.property_type
                  }
                  onChange={
                    handleChange
                  }
                >

                  <option>
                    Apartment
                  </option>

                  <option>
                    Bedsitter
                  </option>

                  <option>
                    Studio
                  </option>

                  <option>
                    1 Bedroom
                  </option>

                  <option>
                    2 Bedroom
                  </option>

                  <option>
                    3 Bedroom
                  </option>

                  <option>
                    House
                  </option>

                  <option>
                    Maisonette
                  </option>

                  <option>
                    Other
                  </option>

                </select>

              </label>

              <label>
                Location *

                <input
                  name="location"
                  value={
                    form.location
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="e.g. Kasarani, Nairobi"
                />
              </label>

              <label>
                Monthly rent (KSh) *

                <input
                  name="rent"
                  type="number"
                  value={
                    form.rent
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="25000"
                />
              </label>

              <label>
                Description

                <textarea
                  name="description"
                  value={
                    form.description
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Describe the property..."
                  rows="5"
                />
              </label>

              <label>
                Landlord name *

                <input
                  name="landlord_name"
                  value={
                    form.landlord_name
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Your name"
                />
              </label>

              <label>
                WhatsApp number *

                <input
                  name="whatsapp"
                  value={
                    form.whatsapp
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="254712345678"
                />
              </label>

              <label>
                Property photos *

                <input
                  id="property-images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={
                    handleImageChange
                  }
                />

                <small className="upload-help">
                  Upload up to 5
                  photos. Maximum
                  5MB each.
                </small>

              </label>

              {
                selectedImages.length >
                  0 && (

                  <div className="image-preview">

                    {
                      selectedImages.map(
                        (
                          file,
                          index
                        ) => (

                          <div
                            className="preview-item"
                            key={
                              index
                            }
                          >

                            <img
                              src={URL.createObjectURL(
                                file
                              )}
                              alt={`Preview ${
                                index +
                                1
                              }`}
                            />

                          </div>

                        )
                      )
                    }

                  </div>

                )
              }

              <button
                type="submit"
                className="primary-button submit-button"
                disabled={
                  loading
                }
              >
                {
                  uploading
                    ? "Uploading photos..."
                    : loading
                    ? "Submitting..."
                    : "Submit Property"
                }
              </button>

              <p className="verification-note">
                🛡️ Your property
                will be reviewed
                before appearing
                publicly.
              </p>

            </form>

          </div>

        </section>

      )}

    </div>
  );
}