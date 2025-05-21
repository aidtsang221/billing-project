import express from "express";
import * as bldgController from "../controllers/bldgController.js";

const router = express.Router();

router.get("/", bldgController.getAllBldgs);

router.get("/add", bldgController.showAddForm);

router.post("/", bldgController.addBldg);

export default router;
