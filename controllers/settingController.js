import pool from "../db.js";

async function getBldgById(id) {
  const [bldgs] = await pool.query("SELECT * FROM bldg WHERE bldg_id = ?", [
    id,
  ]);

  return bldgs[0];
}

export const getAllSettings = async (req, res) => {
  const bldgId = req.params.bldgId;

  try {
    const building = await getBldgById(bldgId);

    const [settings] = await pool.query(
      `
      SELECT 
        s.setting_id,
        s.category,
        b.bldg_name,
        COALESCE(ad.amount, us.rate) AS value,
        COALESCE(ad.start_date, us.start_date) AS start_date,
        COALESCE(ad.end_date, us.end_date) AS end_date,
        COALESCE(ad.due_date, us.due_date) AS due_date
      FROM settings s
      JOIN bldg b ON s.bldg_id = b.bldg_id
      LEFT JOIN assocdues_settings ad ON s.setting_id = ad.setting_id
      LEFT JOIN utility_settings us ON s.setting_id = us.setting_id
      WHERE s.bldg_id = ?`,
      [bldgId]
    );

    res.render(`settings/index`, { settings, building });
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).send("Error fetching settings. Please check backend.");
  }
};

export const showAddSettingForm = async (req, res) => {
  const bldgId = req.params.bldgId;
  try {
    const bldg = await getBldgById(bldgId);

    //Display list of categories in create form
    const categories = ["association_dues", "water", "electricity", "internet"];

    res.render("settings/add", { categories, bldg });
  } catch (error) {
    console.error("Error loading settings:", error);
    res.status(500).send("Error loading settings. Please try again.");
  }
};

export const addSetting = async (req, res) => {
  const bldgId = req.params.bldgId;
  const { category, value, start_date, end_date, due_date } = req.body;

  if (!category || !value || !start_date || !end_date || !due_date) {
    return res
      .status(400)
      .send(
        "Category, Value, Start date, End date, and due date are required."
      );
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [settingResult] = await connection.execute(
      "INSERT INTO settings (bldg_id, category, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
      [bldgId, category]
    );

    const settingId = settingResult.insertId;

    if (category === "association_dues") {
      await connection.execute(
        `INSERT INTO assocdues_settings (setting_id, amount, start_date, end_date, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [settingId, value, start_date, end_date, due_date]
      );
    } else if (
      category === "water" ||
      category === "electricity" ||
      category === "internet"
    ) {
      await connection.execute(
        `INSERT INTO utility_settings (setting_id, rate, start_date, end_date, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [settingId, value, start_date, end_date, due_date]
      );
    }

    await connection.commit();
    res.redirect(`/settings/${bldgId}`);
  } catch (error) {
    await connection.rollback();
    console.error("Error adding settings:", error);
    res.status(500).send("Error adding settings. Please try again.");
  }
};

//Show update settings form
export const showEditSettingsForm = async (req, res) => {
  const settingId = req.params.settingId;

  try {
    const [rows] = await pool.query(
      `
      SELECT 
        s.setting_id,
        s.category,
        s.bldg_id,
        b.bldg_name,
        COALESCE(ad.amount, us.rate) AS value,
        COALESCE(ad.start_date, us.start_date) AS start_date,
        COALESCE(ad.end_date, us.end_date) AS end_date,
        COALESCE(ad.due_date, us.due_date) AS due_date
      FROM settings s
      JOIN bldg b ON s.bldg_id = b.bldg_id
      LEFT JOIN assocdues_settings ad ON s.setting_id = ad.setting_id
      LEFT JOIN utility_settings us ON s.setting_id = us.setting_id
      WHERE s.setting_id = ?
    `,
      [settingId]
    );

    if (rows.length === 0) {
      return res.status(404).send("Setting not found.");
    }

    const setting = rows[0];

    res.render("settings/edit", { setting });
  } catch (error) {
    console.error("Error loading edit setting form:", error);
    res.status(500).send("Error loading the page. Please try again.");
  }
};

//Update Settings
export const updateSettings = async (req, res) => {
  const settingId = req.params.settingId;
  const { value, start_date, end_date, due_date } = req.body;

  // Basic validation
  if (!value || !start_date || !end_date || !due_date) {
    return res.status(400).send("All fields are required.");
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [settings] = await connection.execute(
      "SELECT category, bldg_id FROM settings WHERE setting_id = ?",
      [settingId]
    );

    if (settings.length === 0) {
      throw new Error("Setting not found during update.");
    }

    const { category, bldg_id } = settings[0];

    if (category === "association_dues") {
      await connection.execute(
        `UPDATE assocdues_settings SET amount = ?, start_date = ?, end_date = ?, due_date = ?, updated_at = NOW() WHERE setting_id = ?`,
        [value, start_date, end_date, due_date, settingId]
      );
    } else if (
      category === "water" ||
      category === "electricity" ||
      category === "internet"
    ) {
      await connection.execute(
        `UPDATE utility_settings SET rate = ?, start_date = ?, end_date = ?, due_date = ?, updated_at = NOW() WHERE setting_id = ?`,
        [value, start_date, end_date, due_date, settingId]
      );
    }

    await connection.commit();

    res.redirect(`/settings/${bldg_id}`);
  } catch (error) {
    await connection.rollback();
    console.error("Error updating setting:", error);
    res
      .status(500)
      .send("Error updating setting. The operation was rolled back.");
  }
};
