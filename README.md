# Chat App Backend

Node.js + Express + Socket.IO + MongoDB backend for a real-time chat application.

## Folder structure

```
server/
  routes/        REST route definitions
  models/        Mongoose schemas (User, Message, Group)
  socket/        Socket.IO connection & event handlers (index.js)
  middleware/    JWT auth middleware
  controllers/   Route handler logic
  uploads/       Locally stored uploaded files (served at /uploads)
  server.js      App entry point
  seed.js        Creates two test users
  .env.example   Template for environment variables
```

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

Copy the example file and fill in your own values:

```bash
cp server/.env.example server/.env
```

`server/.env` should contain:

```
PORT=5000
MONGO_URI=mongodb://localhost:27017/chatapp
JWT_SECRET=replace_this_with_a_long_random_secret
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:3000
```

- For local development, make sure MongoDB is running locally (`mongodb://localhost:27017/chatapp`), or point Compass at the same URI to inspect data as you test.
- When you deploy (Render/Railway), just replace `MONGO_URI` with your MongoDB Atlas connection string — no code changes needed.

## 3. Run MongoDB locally

Make sure `mongod` is running, e.g.:

```bash
mongod --dbpath /path/to/your/db
```

Then open MongoDB Compass and connect to `mongodb://localhost:27017` to watch collections (`users`, `messages`, `groups`) update as you test.

## 4. (Optional) Seed test users

```bash
npm run seed
```

Creates:
- alice@example.com / password123
- bob@example.com / password123

## 5. Start the server

```bash
npm run dev     # with nodemon, auto-restarts on changes
# or
npm start        # plain node
```

Server runs at `http://localhost:5000` by default. Health check: `GET /api/health`.

## REST API summary

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register a new user |
| POST | `/api/auth/login` | Public | Log in, returns JWT |
| GET | `/api/users` | Private | List all users except current |
| GET | `/api/messages/:conversationId?type=dm\|group&page=&limit=` | Private | Paginated chat history |
| POST | `/api/groups` | Private | Create a group |
| POST | `/api/groups/:id/members` | Private | Add a member (admin only) |
| DELETE | `/api/groups/:id/members/:userId` | Private | Remove a member |
| POST | `/api/upload` | Private | Upload a file (multipart field name: `file`) |

For all `Private` routes, send `Authorization: Bearer <token>` in the request headers.

## Socket.IO

Connect from the frontend with the JWT in the auth handshake:

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: { token: localStorage.getItem('token') },
});
```

### Events

| Event | Direction | Payload |
|---|---|---|
| `user_status` | server → client | `{ userId, isOnline, lastSeen }` |
| `send_message` | client → server | `{ text, fileUrl, receiverId? , groupId? }` (ack callback returns `{ success, message }`) |
| `receive_message` | server → client | full message object |
| `typing` | both | `{ receiverId? , groupId? }` |
| `stop_typing` | both | `{ receiverId? , groupId? }` |
| `join_group` | client → server | `groupId` (call after creating/joining a group) |
| `leave_group` | client → server | `groupId` |

## Notes

- Passwords are hashed with bcrypt before being stored; the raw password is never returned by the API.
- Message model requires either a `receiver` or a `group`, and either `text` or `fileUrl`.
- The in-memory `userId -> Set<socketId>` map (in `socket/index.js`) supports multiple simultaneous connections per user (e.g. two browser tabs) without incorrectly marking the user offline.
- Uploaded files are stored locally in `server/uploads` and served at `/uploads/<filename>`. When you deploy, consider swapping this for S3/Cloudinary since most PaaS filesystems are ephemeral.
