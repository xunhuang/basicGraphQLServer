import * as admin from 'firebase-admin';
import express from 'express';
import { ApolloServer, ApolloError, ValidationError, gql } from 'apollo-server-express';
// import { ApolloServer, ApolloError, ValidationError, gql } from 'apollo-server';


const serviceAccount = require('../service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

interface User {
  id: string;
  name: string;
  screenName: string;
  statusesCount: number;
}

interface Tweet {
  id: string;
  likes: number;
  text: string;
  userId: string;
}

// Type definitions define the "shape" of your data and specify
// which ways the data can be fetched from the GraphQL server.
const typeDefs = gql`
 # A Twitter User
  type User {
    id: ID!
    name: String!
    screenName: String!
    statusesCount: Int!
    tweets: [Tweets]!
  }
  # A Tweet Object
  type Tweets {
    id: ID!
    text: String!
    userId: String!
    user: User!
    likes: Int!
  }

  input TweetInput {
    text: String!
    userId: String!
  }


  type Query {
    tweets: [Tweets]
    user(id: String!): User
  }

  type Mutation {
     createTweet(input: TweetInput): Tweets
  }
  `;

// Resolvers define the technique for fetching the types in the
// schema.  We'll retrieve books from the "books" array above.
const resolvers = {
  Query: {
    async tweets() {
      const tweets = await admin
        .firestore()
        .collection('tweets')
        .get();
      return tweets.docs.map(tweet => tweet.data()) as Tweet[];
    },
    async user(_: null, args: { id: string }) {
      try {
        const userDoc = await admin
          .firestore()
          .doc(`users/${args.id}`)
          .get();
        const user = userDoc.data() as User | undefined;
        return user || new ValidationError('User ID not found');
      } catch (error) {
        throw new ApolloError(error);
      }
    }
  },
  User: {
    async tweets(user: User) {
      try {
        const userTweets = await admin
          .firestore()
          .collection('tweets')
          .where('userId', '==', user.id)
          .get();
        return userTweets.docs.map(tweet => tweet.data()) as Tweet[];
      } catch (error) {
        throw new ApolloError(error);
      }
    }
  },
  Tweets: {
    async user(tweet: Tweet) {
      try {
        const tweetAuthor = await admin
          .firestore()
          .doc(`users/${tweet.userId}`)
          .get();
        return tweetAuthor.data() as User;
      } catch (error) {
        throw new ApolloError(error);
      }
    }
  },
  Mutation: {
    createTweet:
      async (_: any, input: any, context: any) => {
        try {
          let ref = admin.firestore().collection("tweets").doc();
          const data = {
            id: ref.id,
            ...input.input
          };
          await ref.set(data);
          return data as Tweet;
        } catch (error) {
          throw new ApolloError(error);
        }
      },
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  playground: {
    settings: {
      "editor.theme": "light",
    },
  },
});

const app = express();
server.applyMiddleware({
  app,
  path: '/',
});

app.listen({ port: 4000 }, () => {
  console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`);
});
