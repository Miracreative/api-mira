const { db } = require("../db/index");
const fs = require("fs");
const path = require("path");
const { createSlug } = require("../utils/create-slug");
const { ObjectId } = require("mongodb");

const POSTS_COLLECTION = "posts";
const uploadDir = "uploads/posts";

const setNewPost = async (req, res) => {
    const { author, category, content, title, subtitle } = req.body;
    const image = req.file;

    if (!author || !category || !content || !title || !subtitle || !image) {
        res.status(400).send("Все поля обязательны");
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

    const arrayContent = JSON.parse(content);
    const imagesInContent = arrayContent.blocks
        .map((block) => {
            if (block.type === "image") {
                const url = block.data.file.url;
                const name = url.split("/").pop();
                return name;
            }
        })
        .filter((el) => el != null);

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
            titleImage: newImageName,
            images: imagesInContent,
            slug: createSlug(title),
        });
        res.status(200).send("Пост добавлен");
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

const getPosts = async (req, res) => {
    const { skip, category, limit: limitFromUser } = req.query;
    const defaultLimit = 12;
    const actualLimit = limitFromUser ? Number(limitFromUser) : defaultLimit;
    const filter = {};

    if (category !== "null" && category !== undefined && category !== null) {
        filter["categoryDetails.name"] = category; // Фильтрация по имени категории
    }

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
                    from: "categories",
                    localField: "category.id",
                    foreignField: "_id",
                    as: "categoryDetails",
                },
            },
            {
                $unwind: {
                    path: "$authorDetails",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $unwind: {
                    path: "$categoryDetails",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $project: {
                    author: 0,
                    category: 0,
                },
            },
            {
                $match: filter,
            },
            {
                $sort: { _id: -1 }, // Сортируем от новых к старым
            },
            {
                $facet: {
                    posts: [
                        {
                            $skip: Number(skip) > 0 ? skip * actualLimit : 0,
                        },
                        {
                            $limit: actualLimit,
                        },
                    ],
                    count: [{ $count: "total" }],
                },
            },
            {
                $project: {
                    posts: 1,
                    count: { $arrayElemAt: ["$count.total", 0] },
                },
            },
        ]);

        const allPosts = await cursorPosts.toArray();

        const isMore =
            allPosts[0].count > Number(skip) * actualLimit + actualLimit;

        const resultObject = {
            isMore: isMore,
            posts: allPosts[0].posts,
        };

        res.status(200).json(resultObject);
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
        console.log("onePost", onePost);
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
    const newTitleImage = req.file;

    const postForUpdate = await db
        .collection(POSTS_COLLECTION)
        .findOne({ slug: slug });

    if (!postForUpdate) {
        res.status(404).send("Такой пост не найден");
        return;
    }
    const newImagesInContent = JSON.parse(content)
        .blocks.map((block) => {
            if (block.type === "image") {
                const url = block.data.file.url;
                const name = url.split("/").pop();
                return name;
            }
        })
        .filter((el) => el != null);

    const oldImagesInContent = JSON.parse(postForUpdate.content)
        .blocks.map((block) => {
            if (block.type === "image") {
                const url = block.data.file.url;
                const name = url.split("/").pop();
                return name;
            }
        })
        .filter((el) => el != null);

    const imagesForDelete = [];

    oldImagesInContent.forEach((image) => {
        if (!newImagesInContent.includes(image)) {
            imagesForDelete.push(image);
        }
    });

    let newImageNameWithoutExtension;
    let newTitleImageName;

    if (imagesForDelete.length > 0) {
        for (let image of imagesForDelete) {
            const filePath = path.join("uploads/posts", image);
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.log("error", err);
                    return res.status(500).send("Error deleting file.");
                }
            });
        }
    }
    if (newTitleImage) {
        try {
            const oldTitleImageNameToDelete = postForUpdate.titleImage;
            newImageNameWithoutExtension = newTitleImage?.originalname
                .split(".")
                .slice(0, -1)
                .join("");

            newTitleImageName =
                newImageNameWithoutExtension +
                Date.now() +
                path.extname(newTitleImage?.originalname);

            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir);
            }
            fs.writeFile(
                path.join("uploads/posts", newTitleImageName),
                newTitleImage.buffer,
                (err) => {
                    if (err) {
                        console.log("Error while write file", err);
                        res.status(500).send("Server error");
                        return;
                    }
                }
            );
            fs.unlink(
                path.join("uploads/posts", oldTitleImageNameToDelete),
                (err) => {
                    if (err) {
                        console.log("Error while deleting old image", err);
                        res.status(500).send("Server error");
                        fs.unlink(
                            path.join("uploads/posts", newTitleImageName),
                            (err) => {
                                errorIO = true;
                                if (err) {
                                    console.log(
                                        "Error while deleting old image 2",
                                        err
                                    );
                                }
                            }
                        );
                    }
                }
            );
        } catch (error) {
            console.log("error: ", error);
        }
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

        if (newTitleImage) {
            updateData.titleImage = newTitleImageName;
        }

        await db
            .collection(POSTS_COLLECTION)
            .findOneAndUpdate(
                { slug },
                { $set: updateData },
                { returnDocument: "after" }
            );

        res.status(200).send("Пост успешно обновлен");
    } catch (error) {
        console.error("Error updating post:", error);
        res.status(500).send("Ошибка при обновлении данных");
    }
};

const deletePostById = async (req, res) => {
    const { slug } = req.params;

    const deletedPost = await db
        .collection(POSTS_COLLECTION)
        .findOneAndDelete({ slug: slug });

    if (!deletedPost) {
        return res.status(404).send("Пост не найден");
    }

    const imageNameToDelete = deletedPost?.titleImage;
    const imagesInContentToDelete = JSON.parse(deletedPost?.content)
        ?.blocks.map((block) => {
            if (block.type === "image") {
                const url = block.data.file.url;
                return url.split("/").pop();
            }
        })
        .filter((el) => el != null);

    console.log("post", deletedPost);
    console.log("imageNameToDelete", imageNameToDelete);
    console.log("imagesInContentToDelete", imagesInContentToDelete);

    try {
        console.log("Delete from MongoDB success");

        for (let image of imagesInContentToDelete) {
            const filePath = path.join("uploads/posts", image);
            try {
                await fs.promises.unlink(filePath);
                console.log(`Deleted file: ${filePath}`);
            } catch (err) {
                if (err.code !== "ENOENT") {
                    console.error(`Error deleting file ${filePath}:`, err);
                } else {
                    console.warn(`File not found, skipping: ${filePath}`);
                }
            }
        }

        if (imageNameToDelete) {
            const filePath = path.join("uploads/posts", imageNameToDelete);
            try {
                await fs.promises.unlink(filePath);
                console.log(`Deleted file: ${filePath}`);
            } catch (err) {
                if (err.code !== "ENOENT") {
                    console.error(`Error deleting file ${filePath}:`, err);
                } else {
                    console.warn(`File not found, skipping: ${filePath}`);
                }
            }
        }

        res.status(200).send("Post Deleted");
    } catch (error) {
        console.error("Error deleting post:", error);
        res.status(500).send("Internal Server Error");
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
    getPosts,
    getOnePostBySlug,
    updatePostBySlug,
    deletePostById,
    uploadOneImageForPost,
};
