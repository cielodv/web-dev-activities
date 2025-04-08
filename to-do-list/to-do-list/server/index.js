import express from 'express';
import  db  from './db.js';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());
const PORT = 3000;

// ✅ Get All Titles (Separate Ongoing and Done)
app.get('/get-titles', async (req, res) => {
    try {
        const query = "SELECT * FROM tittles ORDER BY date_modified DESC";
        const result = await db.query(query);

        const ongoing = result.rows.filter(task => task.status === false);
        const done = result.rows.filter(task => task.status === true);

        res.status(200).json({ ongoing, done });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ Get All Lists (For Debugging)
app.get('/get-lists', async (req, res) => {
    try {
        const query = "SELECT * FROM lists";
        const result = await db.query(query);
        res.status(200).json({ lists: result.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ Get a Specific Task (Fetch All Items for a Given Title)
app.get('/get-task', async (req, res) => {
    const { title } = req.query;

    if (!title) {
        return res.status(400).json({ error: "Title is required" });
    }

    try {
        const titleResult = await db.query(
            "SELECT id FROM tittles WHERE title = $1",
            [title]
        );

        if (titleResult.rows.length === 0) {
            return res.status(404).json({ error: "Title not found" });
        }

        const titleId = titleResult.rows[0].id;

        const listResult = await db.query(
            "SELECT list_desc FROM lists WHERE tittle_id = $1",
            [titleId]
        );

        res.status(200).json({ lists: listResult.rows.map(row => row.list_desc) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ Get All Users
app.get('/get-user', async (req, res) => {
    try {
        const query = "SELECT * FROM accounts";
        const users = await db.query(query);
        res.status(200).json({ users: users.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ Check User Credentials
app.post('/check-user', async (req, res) => {
    const { username, password } = req.body;

    try {
        const query = "SELECT * FROM accounts WHERE username=$1 AND password=$2";
        const result = await db.query(query, [username, password]);

        res.status(200).json({ exist: result.rowCount > 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ Register a New User
app.post('/register', async (req, res) => {
    const { username, password, fname, lname } = req.body;

    try {
        const query = "INSERT INTO accounts (username, password, fname, lname) VALUES ($1,$2,$3,$4)";
        await db.query(query, [username, password, fname, lname]);

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ Add a New To-Do Task
app.post('/add-to-do', async (req, res) => {
    const { username, tittles, lists } = req.body;

    try {
        // ✅ Insert new title
        const result = await db.query(
            "INSERT INTO tittles (username, title, date_modified, status) VALUES ($1, $2, NOW(), FALSE) RETURNING id",
            [username, tittles]
        );

        const tittle_id = result.rows[0].id;

        // ✅ Insert all list items
        const queries = lists.map(list_desc =>
            db.query(
                "INSERT INTO lists (tittle_id, list_desc, status) VALUES ($1, $2, FALSE)",
                [tittle_id, list_desc]
            )
        );

        await Promise.all(queries);

        res.status(200).json({
            success: true,
            message: "Task added successfully!"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to insert data",
            error: error.message
        });
    }
});

// ✅ Update a To-Do Task (Keeps Status as FALSE)
app.post('/update-to-do', async (req, res) => {
    const { title_id, list } = req.body;

    if (!title_id || !Array.isArray(list)) {
        return res.status(400).json({
            success: false,
            message: "Invalid request data",
            error: "title_id must be provided and list must be an array"
        });
    }

    try {
        // ✅ Update title and keep status FALSE
        await db.query("UPDATE tittles SET date_modified = NOW(), status = FALSE WHERE id = $1", [title_id]);
        
        // ✅ Remove old list items
        await db.query("DELETE FROM lists WHERE tittle_id = $1", [title_id]);

        // ✅ Insert new list items with status FALSE
        const queries = list.map(list_desc =>
            db.query("INSERT INTO lists (tittle_id, list_desc, status) VALUES ($1, $2, FALSE)", [title_id, list_desc])
        );

        await Promise.all(queries);

        res.status(200).json({
            success: true,
            message: "To-do successfully updated"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to update to-do",
            error: error.message
        });
    }
});

// ✅ Update Task Status (Move to Done Section & Update List Items Too)
app.post('/update-task-status', async (req, res) => {
    const { title } = req.body;

    if (!title) {
        return res.status(400).json({ error: "Title is required" });
    }

    try {
        // ✅ Update task status to TRUE
        await db.query("UPDATE tittles SET status = TRUE WHERE title = $1", [title]);

        // ✅ Also update all related list items
        await db.query(
            "UPDATE lists SET status = TRUE WHERE tittle_id = (SELECT id FROM tittles WHERE title = $1)",
            [title]
        );

        res.status(200).json({ success: true, message: "Task marked as done!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ Start the Server
app.listen(PORT, () => {
    console.log(`Server is running on Port ${PORT}`);
});
