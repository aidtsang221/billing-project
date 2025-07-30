import express from "express";
import * as ownerController from "../controllers/ownerController.js";

const router = express.Router({ mergeParams: true });

router.get("/", ownerController.getAllOwners);

router.get("/add", ownerController.showAddOwnerForm);

router.post("/", ownerController.addOwner);

router.get("/edit/:id", ownerController.showEditOwnerForm);

router.post("/edit/:id", ownerController.updateOwner);

export default router;
