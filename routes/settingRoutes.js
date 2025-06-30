import express from "express";
import * as settingController from "../controllers/settingController.js";

const router = express.Router();

router.get("/:bldgId", settingController.getAllSettings);

router.get("/add/:bldgId", settingController.showAddSettingForm);

router.post("/:bldgId", settingController.addSetting);

router.get("/edit/:settingId", settingController.showEditSettingsForm);

router.post("/edit/:settingId", settingController.updateSettings);

export default router;
