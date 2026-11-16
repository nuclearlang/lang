import 'package:clean_flutter_project/components/episodes/domain/models/episode.dart';
import 'package:clean_flutter_project/components/episodes/domain/usecases/get_episodes_usecase.dart';
import 'package:fpdart/fpdart.dart';
import 'package:synapsis/synapsis.dart';

class EpisodesComponent {
  Future<Either<String, List<Episode>>> getEpisodes(List<int> ids) async {
    return await inject<GetEpisodesUseCase>().exec(ids);
  }
}
