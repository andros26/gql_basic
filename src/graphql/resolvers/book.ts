 import { IResolvers } from '@graphql-tools/utils';
import { Db, ObjectId } from 'mongodb';

// --- Interfaces de la Base de Datos ---

interface BookDb {
    _id?: ObjectId;
    title: string;
    author: string;
    publicationYear: number;
    coverImage?: string;
    ownerId: ObjectId; // Referencia al usuario (DB)
}

interface ReviewDb {
    _id?: ObjectId;
    bookId: ObjectId;
    userId: ObjectId;
    rating: number; // 1 a 5
    comment?: string;
}

// --- Interfaces de Respuesta GraphQL ---

// Incluye el campo 'reviews' y 'averageRating' que requiere un paso extra
interface BookResponse {
    _id: string;
    title: string;
    author: string;
    publicationYear: number;
    coverImage?: string;
    ownerId: string;
    reviews: ReviewResponse[];
    averageRating: number;
}

interface ReviewResponse {
    _id: string;
    bookId: string;
    userId: string;
    rating: number;
    comment?: string;
}

// -----------------------------------------------------------
// FUNCIONES DE UTILIDAD (Mapeo y Cálculo)
// -----------------------------------------------------------

/**
 * Mapea un BookDb (con ObjectId) a un BookResponse (con string IDs) y calcula el rating.
 * @param book El documento del libro de MongoDB.
 * @param reviews Las reseñas asociadas a ese libro.
 * @returns El objeto BookResponse listo para GraphQL.
 */
const mapBookToResponse = (book: BookDb, reviews: ReviewDb[]): BookResponse => {
    // 1. Calcular el rating promedio
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = reviews.length > 0 ? parseFloat((totalRating / reviews.length).toFixed(2)) : 0;

    // 2. Mapear las reseñas
    const reviewResponses: ReviewResponse[] = reviews.map(review => ({
        _id: review._id!.toHexString(),
        bookId: review.bookId.toHexString(),
        userId: review.userId.toHexString(),
        rating: review.rating,
        comment: review.comment,
    }));

    // 3. Mapear el libro
    return {
        _id: book._id!.toHexString(),
        title: book.title,
        author: book.author,
        publicationYear: book.publicationYear,
        coverImage: book.coverImage,
        ownerId: book.ownerId.toHexString(),
        reviews: reviewResponses,
        averageRating: averageRating,
    };
};

/**
 * Función para obtener todas las reseñas de un libro.
 */
const getReviewsForBook = async (context: Db, bookId: ObjectId): Promise<ReviewDb[]> => {
    return await context.collection<ReviewDb>('reviews').find({ bookId: bookId }).toArray() ?? [];
};


// -----------------------------------------------------------
// RESOLVERS
// -----------------------------------------------------------

const bookResolver: IResolvers = {
    Query: {
        // ---------------------------------------------------
        // 2. Listar todos los libros (general)
        // ---------------------------------------------------
        getBooks: async (parent, args, context: Db): Promise<BookResponse[] | undefined> => {
            try {
                const books = await context.collection<BookDb>('books').find().toArray() ?? [];
                
                // Mapear cada libro, obteniendo sus reseñas
                const bookResponses: BookResponse[] = [];
                for (const book of books) {
                    const reviews = await getReviewsForBook(context, book._id!);
                    bookResponses.push(mapBookToResponse(book, reviews));
                }
                
                return bookResponses;

            } catch (error) {
                console.error("Error al listar libros:", error);
                throw new Error("No se pudo obtener la lista de libros.");
            }
        },

        // ---------------------------------------------------
        // 2. Listar libros de un usuario específico
        // ---------------------------------------------------
        getBooksByOwner: async (parent, { ownerId }: { ownerId: string }, context: Db): Promise<BookResponse[] | undefined> => {
            try {
                const books = await context.collection<BookDb>('books').find({ 
                    ownerId: new ObjectId(ownerId) 
                }).toArray() ?? [];

                const bookResponses: BookResponse[] = [];
                for (const book of books) {
                    const reviews = await getReviewsForBook(context, book._id!);
                    bookResponses.push(mapBookToResponse(book, reviews));
                }
                
                return bookResponses;
            } catch (error) {
                console.error("Error al obtener libros por dueño:", error);
                throw new Error("No se pudo obtener la lista de libros del usuario.");
            }
        },
        
        // Obtener un libro por ID
        getBook: async (parent, { id }: { id: string }, context: Db): Promise<BookResponse | null> => {
            try {
                const objectId = new ObjectId(id);
                const book = await context.collection<BookDb>('books').findOne({ _id: objectId });
                
                if (!book) return null;

                const reviews = await getReviewsForBook(context, book._id!);
                return mapBookToResponse(book, reviews);

            } catch (error) {
                console.error("Error al obtener libro:", error);
                throw new Error("No se pudo encontrar el libro.");
            }
        },
    },

    Mutation: {
        // ---------------------------------------------------
        // 1. Añadir un libro
        // ---------------------------------------------------
        addBook: async (root, { ownerId, input }: { ownerId: string, input: Omit<BookDb, 'ownerId'> }, context: Db): Promise<BookResponse> => {
            try {
                const userObjectId = new ObjectId(ownerId);
                
                // 1. Verificar si el ownerId es un usuario existente (opcional pero recomendado)
                const ownerExists = await context.collection('users').findOne({ _id: userObjectId });
                if (!ownerExists) {
                    throw new Error("El usuario dueño (ownerId) no existe.");
                }

                const newBook: Omit<BookDb, '_id'> = {
                    ...input,
                    publicationYear: Number(input.publicationYear), // Aseguramos que sea número
                    ownerId: userObjectId,
                };
                
                // 2. Insertar en la colección 'books'
                const result = await context.collection('books').insertOne(newBook);
                
                // 3. Devolver el objeto BookResponse (sin reseñas iniciales)
                return mapBookToResponse({ 
                    ...newBook, 
                    _id: result.insertedId 
                } as BookDb, []);

            } catch (error) {
                console.error("Error al añadir libro:", error);
                throw new Error(error instanceof Error ? error.message : "Error desconocido al añadir libro.");
            }
        },

        // ---------------------------------------------------
        // 2. Editar un libro
        // ---------------------------------------------------
        editBook: async (root, { id, input }: { id: string, input: Partial<BookDb> }, context: Db): Promise<BookResponse | null> => {
            try {
                const objectId = new ObjectId(id);
                const updateFields: any = { ...input };

                // 1. Actualizar el documento y obtenerlo
                const result = await context.collection<BookDb>('books').findOneAndUpdate(
                    { _id: objectId },
                    { $set: updateFields },
                    { returnDocument: 'after' } 
                );

                if (!result.value) {
                    return null;
                }

                // 2. Obtener reseñas y mapear
                const reviews = await getReviewsForBook(context, result.value._id!);
                return mapBookToResponse(result.value, reviews);

            } catch (error) {
                console.error("Error al editar libro:", error);
                throw new Error("No se pudo editar el libro.");
            }
        },

        // ---------------------------------------------------
        // 2. Eliminar un libro
        // ---------------------------------------------------
        deleteBook: async (root, { id }: { id: string }, context: Db): Promise<boolean> => {
            try {
                const objectId = new ObjectId(id);
                
                // 1. Eliminar reseñas asociadas (Importante para evitar datos huérfanos)
                await context.collection('reviews').deleteMany({ bookId: objectId });
                
                // 2. Eliminar el libro
                const result = await context.collection('books').deleteOne({ _id: objectId });
                
                if (result.deletedCount === 0) {
                    throw new Error("Libro no encontrado.");
                }
                
                return true;
            } catch (error) {
                console.error("Error al eliminar libro:", error);
                throw new Error(error instanceof Error ? error.message : "No se pudo eliminar el libro.");
            }
        },
        
        // ---------------------------------------------------
        // 3. Añadir una calificación y reseña
        // ---------------------------------------------------
        addReview: async (root, { userId, input }: { userId: string, input: { bookId: string, rating: number, comment?: string } }, context: Db): Promise<ReviewResponse> => {
            try {
                const userObjectId = new ObjectId(userId);
                const bookObjectId = new ObjectId(input.bookId);

                // 1. Validaciones (opcional pero bueno)
                if (input.rating < 1 || input.rating > 5) {
                    throw new Error("La calificación debe estar entre 1 y 5 estrellas.");
                }
                
                // Verificar que el libro y el usuario existen (Opcional)
                const bookExists = await context.collection('books').findOne({ _id: bookObjectId });
                if (!bookExists) {
                    throw new Error("El libro especificado no existe.");
                }

                const newReview: Omit<ReviewDb, '_id'> = {
                    bookId: bookObjectId,
                    userId: userObjectId,
                    rating: input.rating,
                    comment: input.comment,
                };
                
                // 2. Insertar la reseña
                const result = await context.collection('reviews').insertOne(newReview);
                
                // 3. Devolver la ReviewResponse
                return {
                    _id: result.insertedId.toHexString(),
                    bookId: newReview.bookId.toHexString(),
                    userId: newReview.userId.toHexString(),
                    rating: newReview.rating,
                    comment: newReview.comment,
                };

            } catch (error) {
                console.error("Error al añadir reseña:", error);
                throw new Error(error instanceof Error ? error.message : "Error desconocido al añadir reseña.");
            }
        }
    }
}

export default bookResolver;