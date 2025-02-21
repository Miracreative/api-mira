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
            console.log("erorr", err);
            if (err) {
                return res.status(500).send("Error saving file.");
            }
        }
    );

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

    ////
    // Декодируем Base64 и сохраняем файл
    // const buffer = Buffer.from(image.base64, "base64");
    // const fileName = Date.now() + `.${image.extension}`; // Генерация уникального имени для файла
    // console.log("in set 2");

    // fs.writeFile(path.join("uploads/posts", fileName), buffer, (err) => {
    //     console.log("erorr", err);
    //     if (err) {
    //         return res.status(500).send("Error saving file.");
    //     }
    //     return {
    //         message: "File uploaded successfully!",
    //         filename: fileName,
    //     };
    // });

    // const id = await db.collection(POSTS_COLLECTION).insertOne({
    //     author: {
    //         ref: "authors",
    //         id: new ObjectId(String(author)),
    //     },
    //     title: title,
    //     category: {
    //         ref: "categories",
    //         id: new ObjectId(String(category)),
    //     },
    //     content: content,
    //     subTitle: subtitle,
    //     image: fileName,
    //     slug: createSlug(title),
    // });
    // res.status(200).send("Post added");
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
        if (onePostCursor) {
            res.status(200).json(onePost);
        } else {
            res.status(404).json({ error: "Not Found" });
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
    let originalImageNameWithoutExtension;
    let newImageName;
    const post = await db.collection(POSTS_COLLECTION).findOne({ slug: slug });
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
                console.log("erorr", err);
                if (err) {
                    return res.status(500).send("Error saving file.");
                }
            }
        );
        const filePath = path.join("uploads/posts", oldImageNameToDelete);
        fs.unlink(filePath, (err) => {
            console.log("error", err);
            if (err) {
                return res.status(500).send("Error deleting file.");
            }
        });
    }

    try {
        const post = await db
            .collection(POSTS_COLLECTION)
            .findOne({ slug: slug });
        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }

        const updateData = {
            author: {
                ref: "authors",
                id: new ObjectId(String(author)),
            },
            title,
            category: {
                ref: "categories",
                id: new ObjectId(String(category)),
            },
            content,
            subTitle: subtitle,
            slug: createSlug(title),
        };

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

        console.log("updatedPost", updatedPost);
        res.status(200).json(updatedPost.value);
    } catch (error) {
        console.error("Error updating post:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const deletePostById = async (req, res) => {
    const { slug } = req.params;
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
    const post = await db
        .collection(POSTS_COLLECTION)
        .deleteOne({ slug: slug });

    if (post.deletedCount === 1) {
        console.log("Delete from mongo success");
        const filePath = path.join("uploads/posts", imageNameToDelete);
        fs.unlink(filePath, (err) => {
            console.log("error", err);
            if (err) {
                return res.status(500).send("Error deleting file.");
            }
        });
        res.status(200).send("Post Deleted");
    }
};

module.exports = {
    setNewPost,
    getAllPosts,
    getOnePostBySlug,
    updatePostBySlug,
    deletePostById,
};
