import express, { Application } from "express";
import cors from "cors";
import { ApolloServer } from "apollo-server-express";
import { schema } from "./graphql";
import { ApolloServerPluginLandingPageGraphQLPlayground } from "apollo-server-core"

const app: Application = express();  // <--- Cambiado a Application
app.use(cors());

const server = new ApolloServer({
    schema,
    introspection: true,
    plugins: [
        ApolloServerPluginLandingPageGraphQLPlayground()
    ]
});

server.start().then(res => {
    server.applyMiddleware({ app });

    app.listen({ port: 4000 }, () => {
        console.log(`🚀 Server ready at http://localhost:${process.env.PORT || 4000}${server.graphqlPath}`);
    });

})