const express = require("express");
const app = express();

app.use(express.json());
app.set('json spaces', 2);

// Root Route
app.get("/", (req, res) => {
    res.json({
        status: true,
        message: "API is running on Render",
        author: "Adi.0X"
    });
});

// Routes setup
app.use("/api/ytmusic", require("./routes/ytmusic-search"));
app.use("/api/fb", require("./routes/fb-inf"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
