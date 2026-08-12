import { useState } from "react";
import { supabase } from "./supabaseClient";
import "./Auth.css";

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // ================= SUBMIT =================

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      // ================= SIGN UP =================

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              role: "landlord",
            },
          },
        });

        if (error) throw error;

        if (data.user) {
          if (data.session) {
            setMessage("Account created successfully.");
            onLogin(data.user);
          } else {
            setMessage(
              "Account created successfully. Please check your email to confirm your account."
            );
          }
        }

        return;
      }

      // ================= LOGIN =================

      if (mode === "login") {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (error) throw error;

        if (data.user) {
          onLogin(data.user);
        }

        return;
      }

      // ================= FORGOT PASSWORD =================

      if (mode === "forgot") {
        const redirectUrl =
          `${window.location.origin}/reset-password`;

        const { error } =
          await supabase.auth.resetPasswordForEmail(
            email,
            {
              redirectTo: redirectUrl,
            }
          );

        if (error) throw error;

        setMessage(
          "Password reset email sent. Please check your email."
        );

        return;
      }
    } catch (error) {
      console.error(error);

      setMessage(
        error.message || "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  };

  // ================= RESET PASSWORD =================

  if (mode === "reset") {
    return (
      <div className="auth-page">
        <div className="auth-card">

          <div className="auth-header">
            <div className="auth-logo">
              Nairobi <span>Rentals</span>
            </div>

            <h1>Set a new password</h1>

            <p>
              Enter your new password below.
            </p>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();

              setLoading(true);
              setMessage("");

              try {
                const { error } =
                  await supabase.auth.updateUser({
                    password,
                  });

                if (error) throw error;

                setMessage(
                  "Password updated successfully. You can now login."
                );

                setTimeout(() => {
                  setMode("login");
                  setPassword("");
                  setMessage("");
                }, 2000);

              } catch (error) {
                console.error(error);

                setMessage(
                  error.message ||
                    "Could not update password."
                );
              } finally {
                setLoading(false);
              }
            }}
          >

            <label>
              New password

              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="At least 6 characters"
                minLength={6}
                required
              />
            </label>

            {message && (
              <div className="auth-message">
                {message}
              </div>
            )}

            <button
              type="submit"
              className="auth-submit"
              disabled={loading}
            >
              {loading
                ? "Updating..."
                : "Update Password"}
            </button>

          </form>

        </div>
      </div>
    );
  }

  // ================= MAIN AUTH =================

  return (
    <div className="auth-page">
      <div className="auth-card">

        <button
          className="auth-back"
          onClick={() => onLogin(null)}
        >
          ← Back to Nairobi Rentals
        </button>

        <div className="auth-header">

          <div className="auth-logo">
            Nairobi <span>Rentals</span>
          </div>

          <h1>
            {mode === "login"
              ? "Welcome back"
              : mode === "signup"
              ? "Create your landlord account"
              : "Reset your password"}
          </h1>

          <p>
            {mode === "login"
              ? "Login to manage your properties."
              : mode === "signup"
              ? "List and manage your rental properties."
              : "Enter your email and we'll send you a password reset link."}
          </p>

        </div>

        <form onSubmit={handleSubmit}>

          {/* ================= SIGNUP NAME ================= */}

          {mode === "signup" && (
            <label>
              Full name

              <input
                type="text"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                placeholder="Your full name"
                required
              />
            </label>
          )}

          {/* ================= EMAIL ================= */}

          <label>
            Email address

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="you@example.com"
              required
            />
          </label>

          {/* ================= PASSWORD ================= */}

          {mode !== "forgot" && (
            <label>
              Password

              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="At least 6 characters"
                minLength={6}
                required
              />
            </label>
          )}

          {/* ================= FORGOT PASSWORD LINK ================= */}

          {mode === "login" && (
            <div
              style={{
                textAlign: "right",
                marginBottom: "15px",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setMessage("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* ================= MESSAGE ================= */}

          {message && (
            <div className="auth-message">
              {message}
            </div>
          )}

          {/* ================= SUBMIT ================= */}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Login"
              : mode === "signup"
              ? "Create Account"
              : "Send Reset Email"}
          </button>

        </form>

        {/* ================= SWITCH ================= */}

        <div className="auth-switch">

          {mode === "login" && (
            <>
              Don't have a landlord account?{" "}

              <button
                onClick={() => {
                  setMode("signup");
                  setMessage("");
                }}
              >
                Create one
              </button>
            </>
          )}

          {mode === "signup" && (
            <>
              Already have an account?{" "}

              <button
                onClick={() => {
                  setMode("login");
                  setMessage("");
                }}
              >
                Login
              </button>
            </>
          )}

          {mode === "forgot" && (
            <>
              Remember your password?{" "}

              <button
                onClick={() => {
                  setMode("login");
                  setMessage("");
                }}
              >
                Back to Login
              </button>
            </>
          )}

        </div>

      </div>
    </div>
  );
}