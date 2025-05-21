import pool from "../db.js";

async function getBldgsForDropdown() {
  const [bldgs] = await pool.query("SELECT bldg_id, bldg_name FROM bldg");
  return bldgs;
}

// Get All Units
export const getAllUnits = async (req, res) => {
  try {
    const [rows] = await pool.query(`
            SELECT u.*, b.bldg_name
            FROM unit u
            JOIN bldg b ON u.bldg_id = b.bldg_id`);
    res.render("units/index", { units: rows });
  } catch (error) {
    console.error("Error fetching units:", error);
    res.status(500).send("Error fetching units.");
  }
};

// Display Add Form
export const showAddForm = async (req, res) => {
  try {
    const bldgs = await getBldgsForDropdown();
    res.render("units/add", { bldgs: bldgs });
  } catch (error) {
    console.error("Error loading add unit form:", error);
    res.status(500).send("Error loading add unit form. Please try again.");
  }
};

// Create New Building
export const addUnit = async (req, res) => {
  const { bldg_id, first_name, last_name, unit_no, unit_area } = req.body;

  // Basic validation
  if (
    !bldg_id ||
    !first_name ||
    !last_name ||
    !unit_no ||
    !unit_area ||
    first_name.trim() === "" ||
    last_name.trim() === "" ||
    isNaN(unit_no) ||
    isNaN(unit_area)
  ) {
    return res
      .status(400)
      .send("All fields are required and unit number/area must be numbers.");
  }

  try {
    await pool.query(
      "INSERT INTO unit (bldg_id, first_name, last_name, unit_no, unit_area) VALUES (?, ?, ?, ?, ?)",
      [bldg_id, first_name.trim(), last_name.trim(), unit_no, unit_area]
    );
    res.redirect("/units");
  } catch (error) {
    console.error("Error adding unit:", error);
    res.status(500).send("Error adding unit. Please try again.");
  }
};

// Display Edit Form - To Be Added
export const showEditForm = async (req, res) => {};

// Update Existing Building - To be Added
export const updateUnit = async (req, res) => {};
