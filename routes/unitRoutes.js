import express from "express";
import * as unitController from "../controllers/unitController.js";

const router = express.Router();

router.get("/", unitController.getAllUnits);

router.get("/add", unitController.showAddForm);

router.post("/", unitController.addUnit);

export default router;
