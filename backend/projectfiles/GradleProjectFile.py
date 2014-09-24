import re

from backend.projectfiles.GenericProjectFile import GenericProjectFile


QUOTE = r'(?:["|\'])'
STRING = r'([\w\.\-\+]+)'
GAV_REGEXP = QUOTE + '(?:' + ":".join([STRING, STRING, STRING]) + ')' + QUOTE


class GradleProjectFile(GenericProjectFile):
    """ Gradle project file implementation to extract dependencies """
    def extract(self):
        dependencies = []
        for line in self.result.iter_lines():
            results = re.match('.*' + GAV_REGEXP + '.*', line)
            if results:
                group = results.group(1)
                artifact = results.group(2)
                version = results.group(3)
                dependencies.append({'group': group,
                                     'artifact': artifact,
                                     'version': version,
                                     'gav': ":".join([group, artifact, version])})
        return dependencies

