// api/test.js
export default function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
        message: 'API is working',
        method: req.method,
        timestamp: new Date().toISOString(),
        env: {
            hasToken: !!process.env.GITHUB_TOKEN
        }
    });
}
