import express from "express";
import * as unitController from "../controllers/unitController.js";

const router = express.Router();

router.get("/", unitController.getAllUnits);

router.get("/add", unitController.showAddForm);

router.post("/", unitController.addUnit);

router.get("/edit/:unitId", unitController.showEditForm);

router.post("/edit/:unitId", unitController.updateUnit);

export default router;
