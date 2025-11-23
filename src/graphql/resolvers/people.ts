import { IResolvers } from '@graphql-tools/utils';
import { Db } from 'mongodb'; // Asegúrate de que Db esté importado

const peopleResolver: IResolvers = {
    Query: {
        // Mantenemos este Query que usa MongoDB
        getPeopleInMongo: async (parent, args, context: Db) => {
            try {
                return await context.collection('people').find().toArray() ?? [];
            } catch (error) {
                console.log(error);
            }
        },
        // *** SE ELIMINARON: getPeople y getPersonByName (usaban peopleDataSource) ***
    },
    Mutation: {
        // Mantenemos esta Mutation que usa MongoDB
        createPersonInMongo: async (root: void, args: any, context: Db) => {
            try {
                const person = await context.collection('people').insertOne(args.person);
                return "Person created successfully";
            } catch (error) {
                console.log(error);
            }
        },
        // *** SE ELIMINARON: createPerson, updatePerson, y deletePerson (usaban peopleDataSource) ***
    }
}

export default peopleResolver;