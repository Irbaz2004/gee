// AdminData.jsx
import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../config";
import Logo from "../assets/Logo.png";

const AdminData = () => {
  const [adminData, setAdminData] = useState({
    companyName: "",
    companyAddress: "",
    companyEmail: "",
    companyGSTIN: "",
    companyContact: "",
    companyDescription: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState({ message: "", type: "" });

  const showNotification = (message, type = "info") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification({ message: "", type: "" });
    }, 3000);
  };

  // Fetch existing admin data on component mount
  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const adminCollection = collection(db, "adminSettings");
      const q = query(adminCollection, orderBy("timestamp", "desc"), limit(1));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const latestData = snapshot.docs[0].data();
        setAdminData({
          companyName: latestData.companyName || "",
          companyAddress: latestData.companyAddress || "",
          companyEmail: latestData.companyEmail || "",
          companyGSTIN: latestData.companyGSTIN || "",
          companyContact: latestData.companyContact || "",
          companyDescription: latestData.companyDescription || "",
        });
        showNotification("Company details loaded successfully!", "success");
      } else {
        showNotification("No company details found. Please add them.", "info");
      }
    } catch (error) {
      console.error("Error fetching admin data:", error);
      showNotification("Failed to load company details", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setAdminData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const saveAdminData = async () => {
    try {
      setSaving(true);
      
      // Validate required fields
      if (!adminData.companyName || !adminData.companyGSTIN) {
        showNotification("Company Name and GSTIN are required", "error");
        return;
      }

      const adminDataWithTimestamp = {
        ...adminData,
        timestamp: new Date().toISOString(),
      };

      const adminCollection = collection(db, "adminSettings");
      await addDoc(adminCollection, adminDataWithTimestamp);
      
      showNotification("Company details saved successfully!", "success");
    } catch (error) {
      console.error("Error saving admin data:", error);
      showNotification("Failed to save company details", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Notification */}
      {notification.message && (
        <div style={{
          ...styles.notification,
          backgroundColor: notification.type === "error" ? "#f44336" : 
                          notification.type === "success" ? "#4caf50" : "#2196f3",
        }}>
          <div style={styles.notificationContent}>
            <span style={{ fontWeight: "bold" }}>
              {notification.type === "error" ? "Error" : 
               notification.type === "success" ? "Success" : "Info"}
            </span>
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      <h1 style={styles.title}>Company Details Configuration :</h1>

      <div style={styles.content}>
        {/* Logo Display */}
        <div style={styles.logoSection}>
          <h3 style={styles.sectionTitle}>Company Logo</h3>
          <div style={styles.logoContainer}>
            <img src={Logo} alt="Company Logo" style={styles.logo} />
          </div>
        </div>

        {/* Company Details Form */}
        <div style={styles.formSection}>
          <h3 style={styles.sectionTitle}>Company Information</h3>
          
          {loading ? (
            <div style={styles.loading}>Loading company details...</div>
          ) : (
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Company Name *</label>
                <input
                  type="text"
                  name="companyName"
                  value={adminData.companyName}
                  onChange={handleInputChange}
                  style={styles.input}
                  placeholder="Enter company name"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Company Address</label>
                <textarea
                  name="companyAddress"
                  value={adminData.companyAddress}
                  onChange={handleInputChange}
                  rows="3"
                  style={styles.textarea}
                  placeholder="Enter company address"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Company Email</label>
                <input
                  type="email"
                  name="companyEmail"
                  value={adminData.companyEmail}
                  onChange={handleInputChange}
                  style={styles.input}
                  placeholder="Enter company email"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Company GSTIN *</label>
                <input
                  type="text"
                  name="companyGSTIN"
                  value={adminData.companyGSTIN}
                  onChange={handleInputChange}
                  style={styles.input}
                  placeholder="Enter GSTIN number"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Company Contact</label>
                <input
                  type="text"
                  name="companyContact"
                  value={adminData.companyContact}
                  onChange={handleInputChange}
                  style={styles.input}
                  placeholder="Enter contact number"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Company Description</label>
                <textarea
                  name="companyDescription"
                  value={adminData.companyDescription}
                  onChange={handleInputChange}
                  rows="4"
                  style={styles.textarea}
                  placeholder="Enter company description"
                />
              </div>
            </div>
          )}

          <div style={styles.buttonContainer}>
            <button
              onClick={saveAdminData}
              disabled={saving}
              style={{
                ...styles.saveButton,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving..." : "Save Company Details"}
            </button>
            
            <button
              onClick={fetchAdminData}
              style={styles.refreshButton}
            >
              Refresh / Load Latest
            </button>
          </div>

          <div style={styles.instructions}>
            <p><strong>Note:</strong> Fields marked with * are required.</p>
            <p>Logo should be placed in <code>src/assets/Logo.png</code></p>
            <p>This data will be used in invoice generation</p>
          </div>
        </div>
      </div>

      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
          * {
            font-family: 'Poppins', sans-serif;
          }
        `}
      </style>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: "#FFFFFF",
    minHeight: "100vh",
    padding: "30px",
    fontFamily: "'Poppins', sans-serif",
    borderRadius: "20px",
  },
  title: {
    color: "#ffffff",
    marginBottom: "40px",
    fontSize: "1.8rem",
    fontWeight: "600",
    padding: "5px",
    paddingLeft: "15px",
    backgroundColor: "#001F3F",
    borderRadius: "8px",
  },
  content: {
    maxWidth: "1200px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "300px 1fr",
    gap: "40px",
  },
  logoSection: {
    backgroundColor: "#F8FAFF",
    padding: "25px",
    borderRadius: "10px",
    border: "2px solid #001F3F",
    height: "fit-content",
  },
  logoContainer: {
    textAlign: "center",
  },
  logo: {
    width: "200px",
    height: "auto",
    marginBottom: "15px",
    border: "1px solid #ddd",
    borderRadius: "5px",
    padding: "10px",
    backgroundColor: "white",
  },
  logoNote: {
    fontSize: "0.9rem",
    color: "#666",
    fontStyle: "italic",
  },
  formSection: {
    backgroundColor: "#F8FAFF",
    padding: "30px",
    borderRadius: "10px",
    border: "2px solid #001F3F",
  },
  sectionTitle: {
    color: "#001F3F",
    fontSize: "1.4rem",
    marginBottom: "25px",
    fontWeight: "600",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "25px",
    marginBottom: "30px",
  },
  formGroup: {
    marginBottom: "15px",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#001F3F",
    fontSize: "1rem",
    fontWeight: "500",
  },
  input: {
    width: "100%",
    padding: "12px 15px",
    border: "2px solid #001F3F",
    borderRadius: "6px",
    fontSize: "1rem",
    backgroundColor: "#FFFFFF",
    color: "#001F3F",
    boxSizing: "border-box",
    transition: "all 0.3s ease",
  },
  textarea: {
    width: "100%",
    padding: "12px 15px",
    border: "2px solid #001F3F",
    borderRadius: "6px",
    fontSize: "1rem",
    backgroundColor: "#FFFFFF",
    color: "#001F3F",
    boxSizing: "border-box",
    resize: "vertical",
    minHeight: "100px",
    transition: "all 0.3s ease",
  },
  buttonContainer: {
    display: "flex",
    gap: "20px",
    marginBottom: "30px",
  },
  saveButton: {
    backgroundColor: "#001F3F",
    color: "#FFFFFF",
    border: "none",
    padding: "15px 30px",
    borderRadius: "6px",
    fontSize: "1.1rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    flex: 1,
  },
  refreshButton: {
    backgroundColor: "#4CAF50",
    color: "#FFFFFF",
    border: "none",
    padding: "15px 30px",
    borderRadius: "6px",
    fontSize: "1.1rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    flex: 1,
  },
  instructions: {
    backgroundColor: "#E8F4F8",
    padding: "20px",
    borderRadius: "6px",
    border: "1px solid #001F3F",
    fontSize: "0.95rem",
    color: "#001F3F",
  },
  notification: {
    position: "fixed",
    top: "20px",
    right: "20px",
    padding: "15px 20px",
    color: "white",
    borderRadius: "5px",
    zIndex: 1000,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    animation: "slideIn 0.3s ease",
    maxWidth: "400px",
  },
  notificationContent: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  loading: {
    textAlign: "center",
    padding: "40px",
    fontSize: "1.2rem",
    color: "#666",
  },
};

// Add hover effects
styles.saveButton[':hover'] = {
  backgroundColor: "#003366",
  transform: "translateY(-2px)",
  boxShadow: "0 4px 12px rgba(0, 31, 63, 0.2)",
};

styles.refreshButton[':hover'] = {
  backgroundColor: "#45a049",
  transform: "translateY(-2px)",
  boxShadow: "0 4px 12px rgba(76, 175, 80, 0.2)",
};

styles.input[':hover'] = {
  outline: "none",
  borderColor: "#0056b3",
  boxShadow: "0 0 0 3px rgba(0, 31, 63, 0.1)",
};

styles.input[':focus'] = {
  outline: "none",
  borderColor: "#0056b3",
  boxShadow: "0 0 0 3px rgba(0, 31, 63, 0.1)",
};

styles.textarea[':hover'] = styles.input[':hover'];
styles.textarea[':focus'] = styles.input[':focus'];

export default AdminData;