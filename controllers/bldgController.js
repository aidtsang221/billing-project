import pool from "../db.js";

// Get All Buildings
export const getAllBldgs = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM bldg");
    res.render("bldgs/index", { bldgs: rows });
  } catch (error) {
    console.error("Error fetching buildings:", error);
    res.status(500).send("Error fetching buildings. Please check server logs.");
  }
};

// Display Add Form
export const showAddForm = (req, res) => {
  res.render("bldgs/add");
};

// Create New Building
export const addBldg = async (req, res) => {
  const { bldg_name } = req.body;

  // Basic validation
  if (!bldg_name || bldg_name.trim() === "") {
    return res.status(400).send("Building name is required.");
  }

  try {
    await pool.query("INSERT INTO bldg (bldg_name) VALUES (?)", [
      bldg_name.trim(),
    ]);
    res.redirect("/bldgs");
  } catch (error) {
    console.error("Error adding building:", error);
  }
};

// Display Edit Form
export const showEditForm = async (req, res) => {
  const bldgId = req.params.id;

  try {
    const [rows] = await pool.query("SELECT * FROM bldg WHERE bldg_id = ?", [
      bldgId,
    ]);
    if (rows.length === 0) {
      return res.status(404).send("Building not found.");
    }
    res.render("bldgs/edit", { bldg: rows[0] });
  } catch (error) {
    console.error("Error fetching buildings:", error);
    res.status(500).send("Error loading buildings. Please try again.");
  }
};

// Update Existing Building
export const updateBldg = async (req, res) => {
  const bldgId = req.params.id;
  const { bldg_name } = req.body;

  // Basic validation
  if (!bldg_name || bldg_name.trim() === "") {
    return res.status(400).send("Building name is required.");
  }

  try {
    const [result] = await pool.query(
      "UPDATE bldg SET bldg_name = ? WHERE bldg_id = ?",
      [bldg_name.trim(), bldgId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).send("Building not found or no changes made.");
    }
    res.redirect("/bldgs");
  } catch (error) {
    console.error("Error updating building:", error);
    res.status(500).send("Error updating building. Please try again.");
  }
};
