import express from "express";
import * as utilController from "../controllers/utilController.js";

const router = express.Router({ mergeParams: true });

router.get("/exportWE", utilController.generateWaterElectricExcel);

router.get("/exportI", utilController.generateInternetExcel);

router.get("/:unitId", utilController.getAllUtils);

router.get("/add/:unitId", utilController.showAddForm);

router.post("/:unitId", utilController.addUtilityBill);

router.get("/:utilId/pdf", utilController.generateUtilityPdf);

router.get("/edit/:id", utilController.showEditUtilityForm);

router.post("/edit/:id", utilController.updateUtilityBill);

router.get("/payment/:id", utilController.showEditPaymentForm);

router.post("/payment/:id", utilController.updatePayment);

export default router;
