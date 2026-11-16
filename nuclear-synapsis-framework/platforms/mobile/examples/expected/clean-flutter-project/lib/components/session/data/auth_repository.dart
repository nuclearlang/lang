import 'package:clean_flutter_project/components/session/domain/models/auth.dart';
import 'package:fpdart/fpdart.dart';
import 'package:synapsis/synapsis.dart';

class AuthRepository extends Repository {
  AuthRepository() : super(path: 'auth');

  Future<Either<AuthError, Auth>> login(LoginParams params) => attempt(
        () => send(
          HttpMethod.post,
          'login',
          params: {'params': params},
          decode: Decode.one(Auth.fromJson),
        ),
        Right.new,
        (e) => Left(AuthError(message: e.message)),
      );
}
