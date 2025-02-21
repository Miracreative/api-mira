const { db } = require("../db/index");

const AUTHORS_COLLECTION = "authors";

const getAllAuthors = async (req, res) => {
    try {
        const cursorAuthors = db.collection(AUTHORS_COLLECTION).find();
        const allAuthors = await cursorAuthors.toArray();
        res.status(200).json(allAuthors); // Ответ с кодом 200 и JSON данными
    } catch (error) {
        console.error("Error fetching authors:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = {
    getAllAuthors,
};
