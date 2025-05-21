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

// Display Edit Form - To Be Added
export const showEditForm = async (req, res) => {};

// Update Existing Building - To be Added
export const updateBldg = async (req, res) => {};
