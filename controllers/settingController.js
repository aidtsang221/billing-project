import pool from "../db.js";

export const getAllSettings = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM global_billing_settings");
    res.render("settings/index", { settings: rows });
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).send("Error fetching settings. Please check backend.");
  }
};

export const showAddSettingForm = async (req, res) => {
  try {
    res.render("settings/add");
  } catch (error) {
    console.error("Error loading settings:", error);
    res.status(500).send("Error loading settings. Please try again.");
  }
};

export const addSetting = async (req, res) => {
  const { assoc_amount, util_rate_consump } = req.body;

  if (!assoc_amount || !util_rate_consump) {
    return res
      .status(400)
      .send(
        "Association Dues Amount and Utility Bill Consumption are required."
      );
  }

  try {
    await pool.query(
      "INSERT INTO global_billing_settings (assoc_amount, util_rate_consump, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
      [assoc_amount, util_rate_consump]
    );
    res.redirect(`/settings`);
  } catch (error) {
    console.error("Error adding settings:", error);
    res.status(500).send("Error adding settings. Please try again.");
  }
};
