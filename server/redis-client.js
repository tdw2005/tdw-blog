const redis = require('redis');

class RedisClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.connectionPromise = null;
        this.connect();
    }

    async connect() {
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = new Promise(async (resolve) => {
            try {
                this.client = redis.createClient({
                    socket: {
                        host: process.env.REDIS_HOST || 'localhost',
                        port: process.env.REDIS_PORT || 6379,
                        connectTimeout: 5000,
                        lazyConnect: true
                    },
                    password: process.env.REDIS_PASSWORD || undefined,
                    database: parseInt(process.env.REDIS_DB) || 0
                });

                this.client.on('error', (err) => {
                    console.error(' Redis Client Error:', err);
                    this.isConnected = false;
                    resolve(false);
                });

                this.client.on('connect', () => {
                    this.isConnected = true;
                    resolve(true);
                });

                await this.client.connect();
            } catch (error) {
                console.error(' Redis connection failed:', error);
                this.isConnected = false;
                resolve(false);
            }
        });

        return this.connectionPromise;
    }

    async waitForConnection() {
        if (this.connectionPromise) {
            return await this.connectionPromise;
        }
        return this.isConnected;
    }

    async get(key) {
        if (!this.isConnected) return null;
        try {
            return await this.client.get(key);
        } catch (error) {
            console.error('Redis get error:', error);
            return null;
        }
    }

    async set(key, value, ttl = 3600) {
        if (!this.isConnected) return false;
        try {
            await this.client.set(key, value, { EX: ttl });
            return true;
        } catch (error) {
            console.error('Redis set error:', error);
            return false;
        }
    }

    async setNX(key, value, ttl = 3) {
        if (!this.isConnected) return false;
        try {
            const res = await this.client.set(key, value, { NX: true, EX: ttl });
            return res === 'OK';
        } catch (error) {
            console.error('Redis setNX error:', error);
            return false;
        }
    }

    async del(key) {
        if (!this.isConnected) return false;
        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            console.error('Redis delete error:', error);
            return false;
        }
    }

    async exists(key) {
        if (!this.isConnected) return false;
        try {
            return await this.client.exists(key);
        } catch (error) {
            console.error('Redis exists error:', error);
            return false;
        }
    }

    async keys(pattern) {
        if (!this.isConnected) return [];
        try {
            return await this.client.keys(pattern);
        } catch (error) {
            console.error('Redis keys error:', error);
            return [];
        }
    }

    async scan(pattern) {
        if (!this.isConnected) return [];
        try {
            const keys = [];
            for await (const key of this.client.scanIterator({ MATCH: pattern, COUNT: 200 })) {
                keys.push(key);
            }
            return keys;
        } catch (error) {
            console.error('Redis scan error:', error);
            return [];
        }
    }
}

module.exports = new RedisClient();
