const { db } = require("../db/index");

const AUTHORS_COLLECTION = "categories";

const getAllCategories = async (req, res) => {
    try {
        const cursorCategories = db.collection(AUTHORS_COLLECTION).find();
        const allCategories = await cursorCategories.toArray();
        res.status(200).json(allCategories); // Ответ с кодом 200 и JSON данными
    } catch (error) {
        console.error("Error fetching authors:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = {
    getAllCategories,
};
