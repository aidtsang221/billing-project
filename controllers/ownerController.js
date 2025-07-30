import pool from "../db.js";

// Read All Owners
export const getAllOwners = async (req, res) => {
  try {
    const [owners] = await pool.query(
      `SELECT o.owner_id, o.first_name, o.last_name, 
        u.unit_no, b.bldg_name FROM owner o
        JOIN unit u ON o.unit_id = u.unit_id
        JOIN bldg b ON u.bldg_id = b.bldg_id`
    );
    res.render("owners/index", { owners: owners });
  } catch (error) {
    console.error("Error fetching owners for unit:", error);
    res.status(500).send("Error fetching owners. Please check server logs.");
  }
};

// Display Add Owner Form
export const showAddOwnerForm = async (req, res) => {
  try {
    const [buildingsAndUnits] = await pool.query(`
      SELECT 
        b.bldg_id, 
        b.bldg_name, 
        u.unit_id, 
        u.unit_no 
      FROM bldg b
      JOIN unit u ON b.bldg_id = u.bldg_id
    `);
    //creates an array of building objects, where each building
    // contains its bldg_id, bldg_name, and an array of its units.
    const buildingsMap = new Map();
    buildingsAndUnits.forEach((row) => {
      if (!buildingsMap.has(row.bldg_id)) {
        buildingsMap.set(row.bldg_id, {
          bldg_id: row.bldg_id,
          bldg_name: row.bldg_name,
          units: [],
        });
      }
      buildingsMap.get(row.bldg_id).units.push({
        unit_id: row.unit_id,
        unit_no: row.unit_no,
      });
    });
    const buildings = Array.from(buildingsMap.values());

    res.render("owners/add", { buildings: buildings });
  } catch (error) {
    console.error("Error loading add owner form:", error);
    res.status(500).send("Error loading add owner form. Please try again.");
  }
};

//Create New Owner
export const addOwner = async (req, res) => {
  const { first_name, last_name, unit_id } = req.body;

  if (
    !first_name ||
    !last_name ||
    !unit_id ||
    first_name.trim() === "" ||
    last_name.trim() === ""
  ) {
    return res.status(400).send("First name, last name, unit id are required.");
  }

  try {
    await pool.query(
      "INSERT INTO owner (unit_id, first_name, last_name) VALUES (?, ?, ?)",
      [unit_id, first_name.trim(), last_name.trim()]
    );
    res.redirect(`/owners`);
  } catch (error) {
    console.error("Error adding owner:", error);
    res.status(500).send("Error adding owner. Please try again.");
  }
};

// Display Edit Owner Form
export const showEditOwnerForm = async (req, res) => {
  const ownerId = req.params.id;

  try {
    const [[owner]] = await pool.query(
      `SELECT o.*, u.unit_no, u.bldg_id, b.bldg_name 
       FROM owner o
       JOIN unit u ON o.unit_id = u.unit_id
       JOIN bldg b ON u.bldg_id = b.bldg_id
       WHERE o.owner_id = ?`,
      [ownerId]
    );
    if (owner.length === 0) {
      return res.status(404).send("Owner not found.");
    }

    const [buildingsAndUnits] = await pool.query(`
      SELECT
        b.bldg_id,
        b.bldg_name,
        u.unit_id,
        u.unit_no
      FROM bldg b
      JOIN unit u ON b.bldg_id = u.bldg_id
      ORDER BY b.bldg_name, u.unit_no
    `);

    const buildingsMap = new Map();
    buildingsAndUnits.forEach((row) => {
      if (!buildingsMap.has(row.bldg_id)) {
        buildingsMap.set(row.bldg_id, {
          bldg_id: row.bldg_id,
          bldg_name: row.bldg_name,
          units: [],
        });
      }
      buildingsMap.get(row.bldg_id).units.push({
        unit_id: row.unit_id,
        unit_no: row.unit_no,
      });
    });
    const buildings = Array.from(buildingsMap.values());

    res.render("owners/edit", {
      owner,
      buildings,
    });
  } catch (error) {
    console.error("Error fetching owner:", error);
    res.status(500).send("Error loading owner. Please try again.");
  }
};

// Update Existing Owner
export const updateOwner = async (req, res) => {
  const ownerId = req.params.id;
  const { unit_id, first_name, last_name } = req.body;

  // Basic validation
  if (
    !first_name ||
    !last_name ||
    !unit_id ||
    first_name.trim() === "" ||
    last_name.trim() === ""
  ) {
    return res.status(400).send("First Name and Last Name are required.");
  }

  try {
    const [result] = await pool.query(
      "UPDATE owner SET unit_id = ?, first_name = ?, last_name = ? WHERE owner_id = ?",
      [unit_id, first_name.trim(), last_name.trim(), ownerId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).send("Owner not found or no changes made.");
    }
    res.redirect("/owners");
  } catch (error) {
    console.error("Error updating owner:", error);
    res.status(500).send("Error updating owner. Please try again.");
  }
};
