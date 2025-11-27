import { IResolvers } from '@graphql-tools/utils';
import { Db, ObjectId } from 'mongodb';

// Definición de la estructura de la base de datos (MongoDB)
interface UserDb {
    _id?: ObjectId; 
    name: string;
    lastname: string;
    email: string;
    password: string; // Incluido para ser guardado
}

// Definición de la estructura de respuesta (GraphQL)
// AHORA INCLUYE EL PASSWORD para fines académicos.
interface UserResponse {
    _id: string; 
    name: string;
    lastname: string;
    email: string;
    password: string; // <-- AÑADIDO PARA EL EJERCICIO ACADÉMICO
}


const userResolver: IResolvers = {
    // -----------------------------------------------------------
    // QUERY (Listar y obtener usuarios)
    // -----------------------------------------------------------
    Query: {
        // Retornamos Promise<UserResponse[]>
        getUsers: async (parent, args, context: Db): Promise<UserResponse[] | undefined> => {
            try {
                // Obtenemos todos los documentos. NOTA: Eliminamos 'projection: { password: 0 }' para incluir el password.
                const users = await context.collection<UserDb>('users').find({}).toArray() ?? []; 
                
                // Mapeamos para garantizar que _id es un string y devolvemos todos los campos
                return users.map(user => ({
                    _id: user._id!.toHexString(), // Convertir ObjectId a string
                    name: user.name,
                    lastname: user.lastname,
                    email: user.email,
                    password: user.password, // Incluimos el password
                }));

            } catch (error) {
                console.error("Error al listar usuarios:", error);
                throw new Error("No se pudo obtener la lista de usuarios.");
            }
        },
        // Retornamos Promise<UserResponse>
        getUser: async (parent, { id }: { id: string }, context: Db): Promise<UserResponse | null> => {
            try {
                const objectId = new ObjectId(id);
                // Buscamos un usuario por su ID. No usamos projection para incluir el password.
                const user = await context.collection<UserDb>('users').findOne({ _id: objectId });
                
                if (!user) return null;

                // Mapeamos para garantizar que _id es un string
                return {
                    _id: user._id!.toHexString(), // Convertir ObjectId a string
                    name: user.name,
                    lastname: user.lastname,
                    email: user.email,
                    password: user.password, // Incluimos el password
                };

            } catch (error) {
                console.error("Error al obtener usuario:", error);
                throw new Error("No se pudo encontrar el usuario.");
            }
        },
    },

    // -----------------------------------------------------------
    // MUTATION (Registro, Edición y Eliminación)
    // -----------------------------------------------------------
    Mutation: {
        // Retornamos Promise<UserResponse>
        registerUser: async (root: void, { input }: { input: UserDb }, context: Db): Promise<UserResponse> => {
            try {
                // 1. Verificar si el email ya existe
                const existingUser = await context.collection('users').findOne({ email: input.email });
                if (existingUser) {
                    throw new Error("El correo electrónico ya está registrado.");
                }

                // 2. Desestructuramos para garantizar que solo insertamos campos sin _id
                const { _id, ...newUser } = input; 

                // 3. Insertar el nuevo usuario
                const result = await context.collection('users').insertOne(newUser);
                
                // 4. Devolver el usuario mapeando el _id a string e incluyendo el password
                return {
                    _id: result.insertedId.toHexString(),
                    name: input.name,
                    lastname: input.lastname,
                    email: input.email,
                    password: input.password, // Incluimos el password
                };

            } catch (error) {
                console.error("Error en el registro:", error);
                throw new Error(error instanceof Error ? error.message : "Error desconocido al registrar usuario.");
            }
        },

        // Retornamos Promise<UserResponse>
        editUser: async (root: void, { id, input }: { id: string, input: Partial<UserDb> }, context: Db): Promise<UserResponse | null> => {
            try {
                const objectId = new ObjectId(id);
                const updateFields: any = { ...input };
                
                // Actualizar el documento y obtenerlo. No usamos projection para incluir el password.
                const result = await context.collection<UserDb>('users').findOneAndUpdate(
                    { _id: objectId },
                    { $set: updateFields },
                    { returnDocument: 'after' } 
                );

                if (!result.value) {
                    return null;
                }

                // Devolvemos el documento mapeando el _id a string
                return {
                    _id: result.value._id!.toHexString(),
                    name: result.value.name,
                    lastname: result.value.lastname,
                    email: result.value.email,
                    password: result.value.password, // Incluimos el password
                };

            } catch (error) {
                console.error("Error al editar usuario:", error);
                throw new Error(error instanceof Error ? error.message : "No se pudo editar el usuario.");
            }
        },

        // El resto de la función (deleteUser) no requiere cambios
        deleteUser: async (root: void, { id }: { id: string }, context: Db): Promise<boolean> => {
            try {
                const objectId = new ObjectId(id);
                
                const result = await context.collection('users').deleteOne({ _id: objectId });
                
                if (result.deletedCount === 0) {
                    throw new Error("Usuario no encontrado.");
                }
                
                return true;
            } catch (error) {
                console.error("Error al eliminar usuario:", error);
                throw new Error(error instanceof Error ? error.message : "No se pudo eliminar el usuario.");
            }
        }
    }
}

export default userResolver;