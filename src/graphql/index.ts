import {GraphQLSchema} from 'graphql';
import 'graphql-import-node';
//import  cartoonsSchema from './schemas/cartoons.graphql';
import  peopleSchema from './schemas/people.graphql';
import  userSchema from './schemas/user.graphql';
import  bookSchema from './schemas/book.graphql';
import { makeExecutableSchema, mergeSchemas } from '@graphql-tools/schema';
import mergeTypeDefs from 'graphql-tools-merge-typedefs';
//import cartoonsResolver from './resolvers/cartoons';
import peopleResolver from './resolvers/people';
import userResolver from './resolvers/user';
import bookResolver from './resolvers/book';

export const schema: GraphQLSchema = makeExecutableSchema({
    typeDefs: mergeTypeDefs([
        //cartoonsSchema,
        peopleSchema,
        userSchema,
        bookSchema,
    ]),
    //resolvers: [cartoonsResolver, peopleResolver]
    //resolvers: [peopleResolver]
    resolvers: [peopleResolver, userResolver, bookResolver ]

});