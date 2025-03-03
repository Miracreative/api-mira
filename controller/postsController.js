const { db } = require("../db/index");
const fs = require("fs");
const path = require("path");
const POSTS_COLLECTION = "posts";
const { createSlug } = require("../utils/create-slug");
const { ObjectId } = require("mongodb");

const uploadDir = "uploads/posts";

const setNewPost = async (req, res) => {
    const { author, category, content, title, subtitle } = req.body;
    const image = req.file;

    if (!author || !category || !content || !title || !subtitle || !image) {
        res.status(400).send("All fields required");
        return;
    }

    const originalImageNameWithoutExtension = image.originalname
        .split(".")
        .slice(0, -1)
        .join("");
    const newImageName =
        originalImageNameWithoutExtension +
        Date.now() +
        path.extname(image.originalname);

    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir);
    }

    fs.writeFile(
        path.join("uploads/posts", newImageName),
        image.buffer,
        (err) => {
            if (err) {
                console.log("error", err);
                return res.status(500).send("Error saving file.");
            }
        }
    );

    try {
        await db.collection(POSTS_COLLECTION).insertOne({
            title: title,
            subTitle: subtitle,
            author: {
                ref: "authors",
                id: new ObjectId(String(author)),
            },
            category: {
                ref: "categories",
                id: new ObjectId(String(category)),
            },
            content: content,
            image: newImageName,
            slug: createSlug(title),
        });
        res.status(200).send("Post added");
    } catch (error) {
        console.error(`Error while accessing the database: ${error}`);
        fs.unlink(path.join("uploads/posts", newImageName), (err) => {
            if (err) console.log("error", err);
        });
        res.status(504).send(
            `Server error, while accessing the database:  ${error}`
        );
    }
};

const getAllPosts = async (req, res) => {
    try {
        const cursorPosts = db.collection(POSTS_COLLECTION).aggregate([
            {
                $lookup: {
                    from: "authors",
                    localField: "author.id",
                    foreignField: "_id",
                    as: "authorDetails",
                },
            },
            {
                $lookup: {
                    from: "categories", // Коллекция категорий
                    localField: "category.id", // Поле с ID категории в посте
                    foreignField: "_id", // Поле _id в коллекции категорий
                    as: "categoryDetails", // Название нового поля
                },
            },
            // Разворачиваем автора
            {
                $unwind: {
                    path: "$authorDetails",
                    preserveNullAndEmptyArrays: true,
                },
            },
            // Разворачиваем категорию
            {
                $unwind: {
                    path: "$categoryDetails",
                    preserveNullAndEmptyArrays: true,
                },
            },
            // Фильтрация полей
            {
                $project: {
                    author: 0, // Убираем ссылку автора
                    category: 0,
                },
            },
        ]);
        const allPosts = await cursorPosts.toArray();
        // console.log("all ", allPosts);
        res.status(200).json(allPosts);
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const getOnePostBySlug = async (req, res) => {
    const { slug } = req.params;
    try {
        const onePostCursor = db.collection(POSTS_COLLECTION).aggregate([
            {
                $match: { slug: slug },
            },
            {
                $lookup: {
                    from: "authors",
                    localField: "author.id",
                    foreignField: "_id",
                    as: "authorDetails",
                },
            },
            {
                $lookup: {
                    from: "categories", // Коллекция категорий
                    localField: "category.id", // Поле с ID категории в посте
                    foreignField: "_id", // Поле _id в коллекции категорий
                    as: "categoryDetails", // Название нового поля
                },
            },
            // Разворачиваем автора
            {
                $unwind: {
                    path: "$authorDetails",
                    preserveNullAndEmptyArrays: true,
                },
            },
            // Разворачиваем категорию
            {
                $unwind: {
                    path: "$categoryDetails",
                    preserveNullAndEmptyArrays: true,
                },
            },
            // Фильтрация полей
            {
                $project: {
                    author: 0, // Убираем ссылку автора
                    category: 0,
                },
            },
        ]);
        const onePost = await onePostCursor.toArray();
        if (onePost.length === 1) {
            res.status(200).json(onePost);
        } else {
            res.status(404).send("Not Found");
        }
    } catch (error) {
        console.error("Error fetching post by slug:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const updatePostBySlug = async (req, res) => {
    const { slug } = req.params;
    const { author, category, content, title, subtitle } = req.body;
    const image = req.file;
    let errorIO = false;
    const post = await db.collection(POSTS_COLLECTION).findOne({ slug: slug });
    if (!post) {
        res.status(404).send("Post with this slug does not exist");
        return;
    }

    let originalImageNameWithoutExtension;
    let newImageName;
    const oldImageNameToDelete = post.image;

    if (image) {
        originalImageNameWithoutExtension = image?.originalname
            .split(".")
            .slice(0, -1)
            .join("");

        newImageName =
            originalImageNameWithoutExtension +
            Date.now() +
            path.extname(image?.originalname);

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        fs.writeFile(
            path.join("uploads/posts", newImageName),
            image.buffer,
            (err) => {
                if (err) {
                    console.log("Error while write file", err);
                    res.status(500).send("Server error");
                    errorIO = true;
                    return;
                }
            }
        );
        fs.unlink(path.join("uploads/posts", oldImageNameToDelete), (err) => {
            if (err) {
                errorIO = true;
                console.log("errorIO!!!", errorIO);
                console.log("Error while deleting old image", err);
                res.status(500).send("Server error");
                fs.unlink(path.join("uploads/posts", newImageName), (err) => {
                    errorIO = true;
                    if (err) {
                        console.log("Error while deleting old image 2", err);
                    }
                });
            }
        });
    }

    try {
        const updateData = {};

        if (author) {
            updateData.author = {
                ref: "authors",
                id: new ObjectId(String(author)),
            };
        }

        if (title) {
            updateData.title = title;
            updateData.slug = createSlug(title);
        }

        if (category) {
            updateData.category = {
                ref: "categories",
                id: new ObjectId(String(category)),
            };
        }

        if (content) {
            updateData.content = content;
        }

        if (subtitle) {
            updateData.subTitle = subtitle;
        }

        if (image) {
            updateData.image = newImageName;
        }

        const updatedPost = await db
            .collection(POSTS_COLLECTION)
            .findOneAndUpdate(
                { slug },
                { $set: updateData },
                { returnDocument: "after" }
            );

        res.status(200).json(updatedPost.value);
    } catch (error) {
        console.error("Error updating post:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const deletePostById = async (req, res) => {
    const { slug } = req.params;
    // УБРАТЬ АГРЕГАЦИЮ
    const onePostCursor = db.collection(POSTS_COLLECTION).aggregate([
        {
            $match: { slug: slug },
        },
        {
            $lookup: {
                from: "authors",
                localField: "author.id",
                foreignField: "_id",
                as: "authorDetails",
            },
        },
        {
            $lookup: {
                from: "categories", // Коллекция категорий
                localField: "category.id", // Поле с ID категории в посте
                foreignField: "_id", // Поле _id в коллекции категорий
                as: "categoryDetails", // Название нового поля
            },
        },
        // Разворачиваем автора
        {
            $unwind: {
                path: "$authorDetails",
                preserveNullAndEmptyArrays: true,
            },
        },
        // Разворачиваем категорию
        {
            $unwind: {
                path: "$categoryDetails",
                preserveNullAndEmptyArrays: true,
            },
        },
        // Фильтрация полей
        {
            $project: {
                author: 0, // Убираем ссылку автора
                category: 0,
            },
        },
    ]);
    const onePost = await onePostCursor.toArray();
    const imageNameToDelete = onePost[0]?.image;
    console.log("onePost", onePost);
    console.log("imageNameToDelete", imageNameToDelete);
    console.log("slug", slug);

    // const post = await db
    //     .collection(POSTS_COLLECTION)
    //     .deleteOne({ slug: slug });

    if (post.deletedCount === 1) {
        console.log("Delete from mongo success");
        const filePath = path.join("uploads/posts", imageNameToDelete);
        fs.unlink(filePath, (err) => {
            if (err) {
                console.log("error", err);
                return res.status(500).send("Error deleting file.");
            }
        });
        res.status(200).send("Post Deleted");
    }
};

const uploadOneImageForPost = async (req, res) => {
    const image = req.file;
    const originalImageNameWithoutExtension = image.originalname
        .split(".")
        .slice(0, -1)
        .join("");
    const newImageName =
        originalImageNameWithoutExtension +
        Date.now() +
        path.extname(image.originalname);

    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir);
    }

    fs.writeFile(
        path.join("uploads/posts", newImageName),
        image.buffer,
        (err) => {
            if (err) {
                console.log("error", err);
                return res.status(500).send("Error saving file.");
            }
            return res.status(200).json({
                success: 1,
                file: {
                    url: `https://api.mirabrand.ru/uploads/posts/${newImageName}`,
                },
            });
        }
    );
};

module.exports = {
    setNewPost,
    getAllPosts,
    getOnePostBySlug,
    updatePostBySlug,
    deletePostById,
    uploadOneImageForPost,
};
